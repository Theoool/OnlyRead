'use server';

import { requireUser } from './utils';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema } from '@/lib/shared/validation/schemas';
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

  
  (async () => {
    console.log(`[Background] Starting indexing for manually created article ${article.id}...`);

    // 1. Create Job Record
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
      console.error('[Background] Failed to create job record', e);
    }

    // 2. Process Article
    try {
      await IndexingService.processArticle(article.id, user.id);

      // 3. Complete Job
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
      console.log(`[Background] Indexing finished for manual article ${article.id}`);
    } catch (e) {
      console.error(`[Background] Indexing failed for ${article.id}`, e);
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
  })().catch((e: any) => console.error('[Background] Async execution failed', e));

  return { success: true, article };
}
export async function updateArticleProgress(id: string, progressData: any) {
  const user = await requireUser();
  
  // Merge id into the request body
  const data = { ...progressData, id };

  const article = await ArticlesRepository.update(user.id, data);
  
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
