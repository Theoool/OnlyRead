'use server';

import { requireUser } from './utils';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema, ArticleUpdateSchema } from '@/lib/shared/validation/schemas';
import { devCache } from '@/lib/infrastructure/cache/dev-cache';
import { IndexingService } from '@/lib/core/indexing/service';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { revalidatePath } from 'next/cache';

export async function saveArticle(data: any) {
  const user = await requireUser();

  // Validate input
  const validatedData = ArticleSchema.parse(data);

  const article = await ArticlesRepository.create(user.id, validatedData);

  // Invalidate user's article cache
  devCache.invalidatePattern(`articles:${user.id}:*`);

  // Revalidate Next.js cache
  revalidatePath('/');
  revalidatePath('/read');


  // Trigger Indexing
  try {
    console.log(`[Indexing] Starting indexing for manually created article ${article.id}...`);

    let job;
    try {
      job = await prisma.job.create({
        data: {
          userId: user.id,
          type: 'GENERATE_EMBEDDING',
          status: 'PROCESSING',
          payload: { articleIds: [article.id], source: 'MANUAL_CREATE' },
          progress: 0
        }
      });
    } catch (e) {
      console.error('[Indexing] Failed to create job record', e);
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
      console.log(`[Indexing] Indexing finished for manual article ${article.id}`);
    } catch (e) {
      console.error(`[Indexing] Indexing failed for ${article.id}`, e);
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            result: { error: String(e) }
          }
        }).catch(() => { });
      }
    }
  } catch (e) {
    console.error('[Indexing] Unexpected error', e);
  }

  return { success: true, article };
}
export async function updateArticleProgress(id: string, progressData: any) {
  const user = await requireUser();

  // Merge id into the request body
  const data: any = { ...progressData, id };

  // Map lastReadSentence -> currentPosition
  if (data.lastReadSentence !== undefined) {
    data.currentPosition = data.lastReadSentence;
    delete data.lastReadSentence;
  }

  // Remove lastRead (not a database field)
  if (data.lastRead) {
    delete data.lastRead;
  }

  // Ensure progress is an integer
  if (typeof data.progress === 'number') {
    data.progress = Math.round(data.progress);
  }

  // Validate to ensure no extra fields
  const validatedData = ArticleUpdateSchema.parse(data);

  const article = await ArticlesRepository.update(user.id, validatedData);

  // Invalidate caches
  revalidatePath('/');
  revalidatePath(`/read`);

  return { success: true, article };
}

export async function deleteArticle(id: string) {
  const user = await requireUser();
  await ArticlesRepository.softDelete(id, user.id);

  devCache.invalidatePattern(`articles:${user.id}:*`);
  revalidatePath('/');

  return { success: true };
}

/**
 * Get article navigation data (previous/next articles and collection info)
 * Uses the repository method directly for better performance and type safety
 */
export async function getArticleNavigation(articleId: string) {
  const user = await requireUser();
  
  try {
    // Use the repository method directly - no network overhead
    const navigation = await ArticlesRepository.getNavigation(articleId, user.id);
    return navigation; 
  } catch (error) {
    console.error('Failed to fetch article navigation:', error);
    return { prev: null, next: null, collection: null };
  }
}
