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

  const article = await ArticlesRepository.findById(id, user.id);
  return createSuccessResponse({ article });
});

