import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { CollectionsRepository } from '@/lib/core/reading/collections.repository';

// Helper to get authenticated user
async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/collections
 * List all collections
 */
export const GET = apiHandler(async (req) => {
  const user = await requireUser();
  const collections = await CollectionsRepository.findAll(user.id);
  return createSuccessResponse({ collections });
});

/**
 * POST /api/collections
 * Create a new collection
 */
export const POST = apiHandler(async (req) => {
  const user = await requireUser();
  const json = await req.json();

  // Basic validation (can use Zod schema later)
  if (!json.title) {
    throw new Error('Title is required');
  }

  const collection = await CollectionsRepository.create(user.id, {
    title: json.title,
    description: json.description,
    cover: json.cover,
    type: json.type || 'SERIES',
    author: json.author,
    isbn: json.isbn,
    language: json.language,
  });

  return createSuccessResponse({ collection }, 201);
});
