import { NextResponse } from 'next/server';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { CollectionsRepository } from '@/lib/core/reading/collections.repository';
import { CollectionCreateSchema } from '@/lib/shared/validation/schemas';



/**
 * GET /api/collections
 * List all collections
 */
export const GET = apiHandler(async (req) => {
  const user = await requireUserFromHeader(req);
  const collections = await CollectionsRepository.findAll(user.id);
  return createSuccessResponse({ collections });
});

/**
 * POST /api/collections
 * Create a new collection
 */
export const POST = apiHandler(async (req) => {
  const user = await requireUserFromHeader(req);
  const json = await req.json();

  // Validate with Zod schema
  const data = CollectionCreateSchema.parse(json);

  const collection = await CollectionsRepository.create(user.id, data);

  return createSuccessResponse({ collection }, 201);
});
