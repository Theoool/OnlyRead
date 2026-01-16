import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema } from '@/lib/shared/validation/schemas';
import { UnauthorizedError } from '@/lib/infrastructure/error';

// Helper to get authenticated user or throw
async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/articles
 * List all articles with pagination and filtering
 * Query params:
 * - page: number (default: 1)
 * - pageSize: number (default: 20)
 * - type: string (optional)
 * - includeCollectionArticles: boolean (default: false)
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  // Pagination parameters
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '20');
  const type = searchParams.get('type') || undefined;
  const includeCollectionArticles = searchParams.get('includeCollectionArticles') === 'true';

  const result = await ArticlesRepository.findAll(user.id, {
    page,
    pageSize,
    type,
    includeCollectionArticles
  });

  return createSuccessResponse({
    articles: result.items,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
    }
  });
});

/**
 * POST /api/articles
 * Create a new article
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ArticleSchema.parse(json);

  const article = await ArticlesRepository.create(user.id, data);
  return createSuccessResponse({ article }, 201);
});
