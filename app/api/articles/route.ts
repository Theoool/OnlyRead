import { NextResponse } from 'next/server';
import { getOrCreateUser, requireUserFromHeader } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema } from '@/lib/shared/validation/schemas';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { IndexingService } from '@/lib/core/indexing/service';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { devCache, cacheKeys } from '@/lib/infrastructure/cache';
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

