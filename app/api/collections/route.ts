import { NextResponse } from 'next/server';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError } from '@/lib/infrastructure/error';

export const GET = apiHandler(async (req) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { articles: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return createSuccessResponse({ collections });
});
