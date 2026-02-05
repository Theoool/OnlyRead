'use server';

import { requireUser } from './utils';
import { ContentExtractor } from '@/lib/content-extractor';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { IndexingService } from '@/lib/core/indexing/service';
import { createClient } from '@/lib/supabase/server';
import { FileParser } from '@/lib/file-parser';
import * as crypto from 'crypto';
import { revalidatePath } from 'next/cache';

export async function importUrl(url: string, collectionId?: string) {
  const user = await requireUser();

  if (!url) {
    throw new Error('Missing URL');
  }

  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // Validate collectionId is a valid UUID if present
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validCollectionId = collectionId && uuidRegex.test(collectionId) ? collectionId : null;

  const extractor = new ContentExtractor();
  
  // Use Jina by default
  const extracted = await extractor.extractFromUrl(url, { useJina: true });

  const domain = new URL(url).hostname;

  const article = await prisma.article.create({
    data: {
      title: extracted.title,
      url: url,
      domain: domain,
      userId: user.id,
      collectionId: validCollectionId,
      type: 'markdown',
      body: {
        create: {
          content: extracted.content,
          markdown: extracted.content,
        }
      }
    },
    include: {
      body: true 
    }
  });

  revalidatePath('/');

  // Trigger Indexing
  (async () => {
    console.log(`[Background] Starting indexing for URL article ${article.id}...`);
    
    let job;
    try {
      job = await prisma.job.create({
        data: {
          userId: user.id,
          type: 'GENERATE_EMBEDDING',
          status: 'PROCESSING',
          payload: { articleIds: [article.id], source: 'URL' },
          progress: 0
        }
      });
    } catch (e) {
      console.error('[Background] Failed to create job record', e);
    }

    try {
      await IndexingService.processArticle(article.id, user.id);
      
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: 'COMPLETED', 
            progress: 100,
            result: { processed: 1, total: 1 }
          }
        });
      }
      console.log(`[Background] Indexing finished for URL article ${article.id}`);
    } catch (e) {
      console.error(`[Background] Indexing failed for ${article.id}`, e);
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: 'FAILED', 
            result: { error: String(e) }
          }
        }).catch(() => {});
      }
    }
  })().catch(e => console.error('[Background] Async execution failed', e));

  const { body: articleBody, ...rest } = article;
  return { 
    success: true,
    data: {
      ...rest,
      content: articleBody?.content
    }
  };
}

export async function importFile(filePath: string, originalName: string, fileType?: string) {
  const user = await requireUser();
  const supabase = await createClient();

  if (!filePath || !originalName) {
    throw new Error('Missing filePath or originalName');
  }

  console.log('[Import] Processing file from Supabase:', filePath, originalName);

  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('files')
    .download(filePath);

  if (downloadError || !fileData) {
    console.error('Download error:', downloadError);
    throw new Error('Failed to download file from storage');
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const parser = new FileParser();
  let parsedBook;
  
  const isEpub = originalName.toLowerCase().endsWith('.epub');
  const isPdf = originalName.toLowerCase().endsWith('.pdf');
  const isMd = originalName.toLowerCase().endsWith('.md');
  const isTxt = originalName.toLowerCase().endsWith('.txt');

  if (isEpub) {
    parsedBook = await parser.parseEpub(buffer);
  } else if (isPdf) {
    parsedBook = await parser.parsePdf(buffer);
  } else if (isMd || isTxt) {
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
     throw new Error('Unsupported file format');
  }

  // 1. Create Collection
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

  if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
     await prisma.collection.delete({ where: { id: collection.id } });
     throw new Error('No chapters found in file');
  }

  const articlesData: any[] = [];
  const now = new Date();
  
  parsedBook.chapters.forEach((chapter, index) => {
    const safeContent = (chapter.content || '').replace(/\0/g, ''); 
    const safeTitle = (chapter.title || 'Untitled Chapter').replace(/\0/g, '').substring(0, 1000);
    const totalBlocks = safeContent.split(/\n\s*\n/).filter(Boolean).length;
    const totalReadingTime = Math.ceil(safeContent.length / 400);

    articlesData.push({
      title: safeTitle,
      content: safeContent,
      userId: user.id,
      collectionId: collection.id,
      order: index,
      type: 'markdown',
      domain: 'local-file',
      createdAt: now,
      updatedAt: now,
      progress: 0,
      currentPosition: 0,
      totalBlocks: totalBlocks || 0,
      completedBlocks: 0,
      totalReadingTime: totalReadingTime || 0
    });
  });

  let insertedCount = 0;
  const errors: any[] = [];
  
  if (articlesData.length > 0) {
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < articlesData.length; i += BATCH_SIZE) {
      const batch = articlesData.slice(i, i + BATCH_SIZE);
      try {
        const createdArticles = await prisma.$transaction(
          batch.map((articleData: any) => {
             const { content, ...metaData } = articleData;
             return prisma.article.create({
               data: {
                 ...metaData,
                 body: {
                   create: {
                     content: content,
                     markdown: content,
                   }
                 }
               }
             });
          })
        );
        
        insertedCount += batch.length;

        // Trigger Indexing
        (async () => {
          console.log(`[Background] Starting indexing for ${createdArticles.length} articles...`);
          
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
          }

          let completed = 0;
          for (const article of createdArticles) {
            try {
              await IndexingService.processArticle(article.id, user.id);
              completed++;
              
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
      }
    }
  }
  
  if (articlesData.length > 0 && insertedCount === 0) {
      await prisma.collection.delete({ where: { id: collection.id } });
      throw new Error('Failed to import any chapters');
  }

  // Cleanup file from storage
  await supabase.storage.from('files').remove([filePath]);

  revalidatePath('/');
  revalidatePath('/collections');

  return {
    success: true,
    data: {
      collection: collection,
      articlesCount: insertedCount,
      totalChapters: articlesData.length,
      errors: errors.length > 0 ? errors : undefined,
      warnings: parsedBook.failedChapters?.length ? parsedBook.failedChapters : undefined
    }
  };
}
