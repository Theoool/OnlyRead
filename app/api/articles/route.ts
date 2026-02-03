import { NextResponse } from 'next/server';
import { getOrCreateUser, requireUserFromHeader } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema } from '@/lib/shared/validation/schemas';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { IndexingService } from '@/lib/core/indexing/service';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { devCache, cacheKeys } from '@/lib/infrastructure/cache/dev-cache';
import { API_CONFIG } from '@/lib/config/constants';




export const GET = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req)
  const { searchParams } = new URL(req.url);

  // Pagination parameters
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || String(API_CONFIG.DEFAULT_PAGE_SIZE));
  const type = searchParams.get('type') || undefined;
  const includeCollectionArticles = searchParams.get('includeCollectionArticles') === 'true';

  // Check cache (skip for warmup requests)
  const isWarmup = req.headers.get('x-warmup') === 'true'
  const cacheKey = cacheKeys.articles(user.id, page, pageSize)

  if (!isWarmup) {
    const cached = devCache.get(cacheKey)
    if (cached) {
      return createSuccessResponse(cached)
    }
  }

  const result = await ArticlesRepository.findAll(user.id, {
    page,
    pageSize,
    type,
    includeCollectionArticles
  });
  const response = {
    articles: result.items,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
    }
  };

  // Cache the response (60 seconds TTL)
  if (!isWarmup) {
    devCache.set(cacheKey, response, API_CONFIG.CACHE_TTL_SECONDS)
  }

  return createSuccessResponse(response);
})

/**
 * POST /api/articles
 * Create a new article
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req);
  const json = await req.json();

  // Validate input
  const data = ArticleSchema.parse(json);

  const article = await ArticlesRepository.create(user.id, data);

  // Invalidate user's article cache
  devCache.invalidatePattern(`articles:${user.id}:*`);

  // Trigger Indexing (Chunking + Embedding) - Fire and Forget (Node.js runtime safe)
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

  return createSuccessResponse({ article }, 201);
});
