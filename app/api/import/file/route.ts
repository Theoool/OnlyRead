import { NextResponse } from 'next/server';
import { FileParser } from '@/lib/file-parser';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { IndexingService } from '@/lib/core/indexing/service';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    
    // Support JSON body containing filePath
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 });
    }

    const body = await req.json();
    const { filePath, originalName, fileType } = body;

    if (!filePath || !originalName) {
      return NextResponse.json({ error: 'Missing filePath or originalName' }, { status: 400 });
    }

    console.log('[Import] Processing file from Supabase:', filePath, originalName);

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('files')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const parser = new FileParser();
    let parsedBook;
    
    // Determine file type from original name or fileType
    const isEpub = originalName.toLowerCase().endsWith('.epub');
    const isPdf = originalName.toLowerCase().endsWith('.pdf');
    const isMd = originalName.toLowerCase().endsWith('.md');
    const isTxt = originalName.toLowerCase().endsWith('.txt');

    if (isEpub) {
      parsedBook = await parser.parseEpub(buffer);
    } else if (isPdf) {
      parsedBook = await parser.parsePdf(buffer);
    } else if (isMd || isTxt) {
      // Basic text parsing
      const text = buffer.toString('utf-8');
      parsedBook = {
        title: originalName.replace(/\.[^/.]+$/, ""),
        description: '',
        chapters: [{
          title: originalName,
          content: text,
          order: 0
        }]
      };
    } else {
       return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
    }

    // 1. Create Collection (Outside transaction to reduce lock time)
    // Handle potential undefined or null characters
    const safeTitle = (parsedBook.title || originalName || 'Untitled').replace(/\0/g, '');
    const safeDesc = (parsedBook.description || '').replace(/\0/g, '');

    const collection = await prisma.collection.create({
      data: {
        title: safeTitle,
        description: safeDesc,
        type: isEpub ? 'BOOK' : 'DOCUMENT',
        userId: user.id,
      }
    });

    // 2. Prepare article data
    if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
       await prisma.collection.delete({ where: { id: collection.id } });
       return NextResponse.json({ error: 'No chapters found in file', code: 'NO_CHAPTERS' }, { status: 400 });
    }

    const articlesData: any[] = [];
    const now = new Date(); // Unified timestamp
    
    parsedBook.chapters.forEach((chapter, index) => {
      const id = crypto.randomUUID();
      
      // Ensure content is never empty or null, as it is a required field
      // Also remove null bytes which are not allowed in Postgres
      const safeContent = (chapter.content || '').replace(/\0/g, ''); 
      // Truncate title to fit database limit (1000 chars)
      const safeTitle = (chapter.title || 'Untitled Chapter').replace(/\0/g, '').substring(0, 1000);
      
      // Calculate stats
      const totalBlocks = safeContent.split(/\n\s*\n/).filter(Boolean).length;
      const totalReadingTime = Math.ceil(safeContent.length / 400); // ~400 chars/min

      articlesData.push({
     
        title: safeTitle,
        content: safeContent,
        userId: user.id,
        collectionId: collection.id,
        order: index, // FORCE sequential order to avoid unique constraint violation
        type: 'markdown',
        domain: 'local-file',
        // Explicitly set timestamps for createMany
        createdAt: now,
        updatedAt: now,
        // Explicitly set default values
        progress: 0,
        currentPosition: 0,
        totalBlocks: totalBlocks || 0,
        completedBlocks: 0,
        totalReadingTime: totalReadingTime || 0
      });
    });

    // 3. Batch insert articles (No transaction wrapper to allow partial success/easier debugging)
    // Using smaller batches
    let insertedCount = 0;
    const errors: any[] = [];
    
    if (articlesData.length > 0) {
      const BATCH_SIZE = 5; // Reduced batch size for safety
      
      for (let i = 0; i < articlesData.length; i += BATCH_SIZE) {
        const batch = articlesData.slice(i, i + BATCH_SIZE);
        try {
          // Use transaction to create articles individually to support nested writes (body)
          const createdArticles = await prisma.$transaction(
            batch.map((articleData: any) => {
               // Extract content to separate variable as it's not in Article model
               const { content, ...metaData } = articleData;
               return prisma.article.create({
                 data: {
                   ...metaData,
                   // Add body relation
                   body: {
                     create: {
                       content: content,
                       markdown: content, // Use content as markdown default
                     }
                   }
                 }
               });
            })
          );
          
          insertedCount += batch.length;

          // Trigger Indexing (Chunking + Embedding) - Fire and Forget (Node.js runtime safe)
          // Note: Replaced unstable_after with floating promise due to compatibility issues
          (async () => {
            console.log(`[Background] Starting indexing for ${createdArticles.length} articles...`);
            
            // 1. Create Job Record
            let job;
            try {
              job = await prisma.job.create({
                data: {
                  userId: user.id,
                  type: 'GENERATE_EMBEDDING',
                  status: 'PROCESSING',
                  payload: { articleIds: createdArticles.map(a => a.id) },
                  progress: 0
                }
              });
            } catch (e) {
              console.error('[Background] Failed to create job record', e);
              // Continue processing anyway if job creation fails
            }

            // 2. Process Articles
            let completed = 0;
            for (const article of createdArticles) {
              try {
                await IndexingService.processArticle(article.id, user.id);
                completed++;
                
                // Update progress occasionally
                if (job && completed % 5 === 0) {
                   await prisma.job.update({
                      where: { id: job.id },
                      data: { progress: Math.floor((completed / createdArticles.length) * 100) }
                   }).catch(() => {});
                }
              } catch (e) {
                console.error(`[Background] Indexing failed for ${article.id}`, e);
              }
            }
            
            // 3. Complete Job
            if (job) {
               await prisma.job.update({
                  where: { id: job.id },
                  data: { 
                    status: 'COMPLETED', 
                    progress: 100,
                    result: { processed: completed, total: createdArticles.length }
                  }
               }).catch(e => console.error('[Background] Failed to update job status', e));
            }
            
            console.log(`[Background] Indexing finished. ${completed}/${createdArticles.length} processed.`);
          })().catch(e => console.error('[Background] Async execution failed', e));

        } catch (e: any) {
          console.error(`Failed to insert batch ${i/BATCH_SIZE}:`, e);
          errors.push({
            batch: i/BATCH_SIZE,
            code: e.code,
            message: e.message || String(e),
            meta: e.meta
          });
          // Continue with next batch to save what we can
        }
      }
    }
    
    // If no articles were inserted but we expected some, delete the collection to prevent empty books
    if (articlesData.length > 0 && insertedCount === 0) {
        await prisma.collection.delete({ where: { id: collection.id } });
        return NextResponse.json({
            error: 'Failed to import any chapters. Please check the file content.',
            details: errors,
            code: 'IMPORT_FAILED'
        }, { status: 500 });
    }

    // Optional: Clean up file from storage to save space?
    // For now, let's keep it as a backup or archive.
    await supabase.storage.from('files').remove([filePath]);

    return NextResponse.json({
      data: {
        collection: collection,
        articlesCount: insertedCount, // Return actual inserted count
        totalChapters: articlesData.length,
        errors: errors.length > 0 ? errors : undefined,
        warnings: parsedBook.failedChapters?.length ? parsedBook.failedChapters : undefined
      }
    });

  } catch (error: any) {
    console.error('Import File error:', error);

    // Provide better error messages
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: 'A resource with this identifier already exists',
        code: 'DUPLICATE_ENTRY'
      }, { status: 409 });
    }

    if (error.code === 'P2025') {
      return NextResponse.json({
        error: 'Required record not found',
        code: 'NOT_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json({
      error: error.message || 'Failed to import file',
      code: 'IMPORT_ERROR'
    }, { status: 500 });
  }
}
