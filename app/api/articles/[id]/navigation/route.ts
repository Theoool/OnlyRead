import { NextResponse } from 'next/server';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const resolvedParams = await params;
  const { id } = paramsSchema.parse(resolvedParams);
  
  const { searchParams } = new URL(req.url);
  const includeCollection = searchParams.get('includeCollection') === 'true';

  // Find the article to get its collectionId and order
  const article = await prisma.article.findFirst({
    where: { 
      id, 
      userId: user.id,
      deletedAt: null 
    },
    select: { collectionId: true, order: true }
  });

  if (!article || !article.collectionId) {
    return createSuccessResponse({
      prev: null,
      next: null,
      collection: null
    });
  }

  const queries: Promise<any>[] = [
    // Previous article
    prisma.article.findFirst({
      where: {
        collectionId: article.collectionId,
        order: { lt: article.order || 0 },
        deletedAt: null,
        userId: user.id
      },
      orderBy: { order: 'desc' },
      select: { id: true, title: true }
    }),
    // Next article
    prisma.article.findFirst({
      where: {
        collectionId: article.collectionId,
        order: { gt: article.order || 0 },
        deletedAt: null,
        userId: user.id
      },
      orderBy: { order: 'asc' },
      select: { id: true, title: true }
    })
  ];

  if (includeCollection) {
    queries.push(
      prisma.collection.findUnique({
        where: { id: article.collectionId, userId: user.id },
        select: {
          id: true,
          title: true,
          totalChapters: true,
          completedChapters: true,
          readingProgress: true,
          articles: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              progress: true,
              order: true
            },
            orderBy: { order: 'asc' }
          }
        }
      })
    );
  }

  const results = await Promise.all(queries);
  const prev = results[0];
  const next = results[1];
  const collection = includeCollection ? results[2] : null;

  return createSuccessResponse({
    prev,
    next,
    collection
  });
});
