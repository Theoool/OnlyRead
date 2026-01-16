import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
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
 * GET /api/articles/[id]
 * Get a single article by ID
 */
export const GET = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  // For reading view, we usually need the content
  const article = await ArticlesRepository.findById(id, user.id, { withContent: true });
  return createSuccessResponse({ article });
});

/**
 * PUT /api/articles/[id]
 * Update an article
 */
export const PUT = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const json = await req.json();

  // Merge id into the request body
  const data = { ...json, id };

  const article = await ArticlesRepository.update(user.id, data);
  return createSuccessResponse({ article });
});

/**
 * PATCH /api/articles/[id]
 * Partial update of an article
 */
export const PATCH = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const json = await req.json();

  // Merge id into the request body
  const data = { ...json, id };

  const article = await ArticlesRepository.update(user.id, data);
  return createSuccessResponse({ article });
});

/**
 * DELETE /api/articles/[id]
 * Soft delete an article
 */
export const DELETE = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  await ArticlesRepository.softDelete(id, user.id);
  return createSuccessResponse({ success: true });
});
