import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError, NotFoundError } from '@/lib/infrastructure/error';
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
 * GET /api/collections/[id]
 * Get a collection by ID with articles
 */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  const collection = await CollectionsRepository.findById(id, user.id);

  if (!collection) {
    throw new NotFoundError('Collection');
  }

  return createSuccessResponse({ collection });
});

/**
 * PUT /api/collections/[id]
 * Update a collection
 */
export const PUT = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const json = await req.json();

  const collection = await CollectionsRepository.update(id, user.id, json);
  return createSuccessResponse({ collection });
});

/**
 * DELETE /api/collections/[id]
 * Delete a collection
 */
export const DELETE = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  await CollectionsRepository.delete(id, user.id);

  return createSuccessResponse({ success: true });
});
