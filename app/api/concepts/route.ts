import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/api/response';
import { ConceptsRepository } from '@/lib/core/learning/concepts.repository';
import { ConceptSchema, ConceptUpdateSchema } from '@/lib/shared/validation/schemas';
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
  
  const due = searchParams.get('due') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  const concepts = await ConceptsRepository.findAll(user.id, { limit, due });
  return createSuccessResponse({ concepts });
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ConceptSchema.parse(json);

  const concept = await ConceptsRepository.create(user.id, data);
  return createSuccessResponse({ concept }, 201);
});

export const PUT = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ConceptUpdateSchema.parse(json);

  const concept = await ConceptsRepository.update(user.id, data);
  return createSuccessResponse({ concept });
});

export const DELETE = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    throw new Error('Concept ID is required');
  }

  await ConceptsRepository.softDelete(id, user.id);
  return createSuccessResponse({ success: true });
});
