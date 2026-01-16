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

  // Find the article to get its collectionId and order
  const article = await prisma.article.findUnique({
    where: { id, userId: user.id },
    select: { collectionId: true, order: true }
  });

  if (!article || !article.collectionId) {
    return createSuccessResponse({
      navigation: {
        prev: null,
        next: null,
        collection: null
      }
    });
  }

  // Fetch previous and next articles in the same collection
  const [prev, next, collection] = await Promise.all([
    // Previous article
    prisma.article.findFirst({
      where: {
        collectionId: article.collectionId,
        order: { lt: article.order || 0 },
        deletedAt: null
      },
      orderBy: { order: 'desc' },
      select: { id: true, title: true }
    }),
    // Next article
    prisma.article.findFirst({
      where: {
        collectionId: article.collectionId,
        order: { gt: article.order || 0 },
        deletedAt: null
      },
      orderBy: { order: 'asc' },
      select: { id: true, title: true }
    }),
    // Collection info
    prisma.collection.findUnique({
      where: { id: article.collectionId },
      select: {
        id: true,
        title: true,
        totalChapters: true,
        completedChapters: true,
        readingProgress: true,
        articles: {
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
  ]);

  return createSuccessResponse({
    navigation: {
      prev,
      next,
      collection
    }
  });
});
