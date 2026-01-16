import { NextResponse } from 'next/server';
import { FileParser } from '@/lib/file-parser';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Increase body size limit for this route
// export const config = {
//   api: {
//     bodyParser: {
//       sizeLimit: '50mb',
//     },
//   },
// };

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    console.log('[Upload] Content-Type:', contentType);

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      console.error('[Upload] Failed to parse FormData:', e);
      return NextResponse.json({ error: `Failed to parse body: ${e.message}` }, { status: 400 });
    }

    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('[Upload] File received:', file.name, file.size, file.type);

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE'
      }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new FileParser();
    let parsedBook;

    if (file.name.toLowerCase().endsWith('.epub')) {
      parsedBook = await parser.parseEpub(buffer);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      parsedBook = await parser.parsePdf(buffer);
    } else {
       return NextResponse.json({ error: 'Unsupported file format. Please upload .epub or .pdf' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create Collection
      const collection = await tx.collection.create({
        data: {
          title: parsedBook.title,
          description: parsedBook.description,
          type: file.name.toLowerCase().endsWith('.epub') ? 'BOOK' : 'DOCUMENT',
          userId: user.id,
        }
      });

      // Prepare article data for batch insertion
      const articlesData: any[] = [];
      const articleBodiesData: any[] = [];
      
      parsedBook.chapters.forEach((chapter) => {
        const id = crypto.randomUUID();
        
        articlesData.push({
          id,
          title: chapter.title,
          // content: chapter.content, // Moved to ArticleBody
          userId: user.id,
          collectionId: collection.id,
          order: chapter.order,
          type: 'markdown',
          domain: 'local-file',
        });

        articleBodiesData.push({
          articleId: id,
          content: chapter.content,
          markdown: chapter.content,
        });
      });

      // Batch create articles for performance
      if (articlesData.length > 0) {
        // 1. Create Articles (Metadata)
        await tx.article.createMany({
          data: articlesData,
        });

        // 2. Create ArticleBodies (Content)
        await tx.articleBody.createMany({
          data: articleBodiesData,
        });
      }

      return { collection, articlesCount: articlesData.length };
    });

    return NextResponse.json({
      data: {
        collection: result.collection,
        articlesCount: result.articlesCount,
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
