import { NextResponse } from 'next/server';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError, NotFoundError } from '@/lib/infrastructure/error';

export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const { id } = await params;

  const collection = await prisma.collection.findUnique({
    where: { id, userId: user.id },
    include: {
      articles: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          content: true,  // Include content for reading
          progress: true,
          currentPosition: true,
          totalBlocks: true,
          completedBlocks: true,
          updatedAt: true,
          domain: true,
          type: true,
          order: true,
        }
      }
    }
  });

  if (!collection) {
    throw new NotFoundError('Collection');
  }

  return createSuccessResponse({ collection });
});

export const DELETE = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const { id } = await params;

  await prisma.collection.delete({
    where: { id, userId: user.id }
  });

  return createSuccessResponse({ success: true });
});
