'use server';

import { requireUser } from './utils';
import { ContentExtractor } from '@/lib/content-extractor';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { IndexingService } from '@/lib/core/indexing/service';
import { importFileForUser } from '@/lib/import/import-file';
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

  if (!filePath || !originalName) {
    throw new Error('Missing filePath or originalName');
  }
  return importFileForUser({ userId: user.id, filePath, originalName, fileType });
}
