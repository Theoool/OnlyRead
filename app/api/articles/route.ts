import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema, ArticleUpdateSchema } from '@/lib/shared/validation/schemas';
import { UnauthorizedError } from '@/lib/infrastructure/error';

// Helper to get authenticated user or throw
async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export const GET = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const article = await ArticlesRepository.findById(id, user.id);
    return createSuccessResponse({ article });
  }

  // Pagination parameters
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '20');
  const type = searchParams.get('type') || undefined;

  const result = await ArticlesRepository.findAll(user.id, { page, pageSize, type });
  return createSuccessResponse({ articles: result.items, pagination: {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    hasNext: result.hasNext,
    hasPrevious: result.hasPrevious,
  }});
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ArticleSchema.parse(json);

  const article = await ArticlesRepository.create(user.id, data);
  return createSuccessResponse({ article }, 201);
});

export const PUT = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ArticleUpdateSchema.parse(json);

  const article = await ArticlesRepository.update(user.id, data);
  return createSuccessResponse({ article });
});

export const DELETE = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    throw new Error('Article ID is required'); // Or ValidationError
  }

  await ArticlesRepository.softDelete(id, user.id);
  return createSuccessResponse({ success: true });
});
