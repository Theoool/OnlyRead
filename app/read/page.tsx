import ReaderClient from './ReaderClient';
import { createClient } from '@/lib/supabase/server';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; localId?: string }> }) {
  const { id, localId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <ReaderClient />;
  }

  // If localId, just render Client (it handles local DB)
  if (localId || !id) {
    return <ReaderClient />;
  }

  // Fetch article and navigation in parallel
  const articlePromise = ArticlesRepository.findById(id, user.id);
  const navigationPromise = (async () => {
      // Logic from API route
      const article = await prisma.article.findUnique({
        where: { id, userId: user.id },
        select: { collectionId: true, order: true }
      });

      if (!article || !article.collectionId) return null;

      const [prev, next, collection] = await Promise.all([
        prisma.article.findFirst({
          where: { collectionId: article.collectionId, order: { lt: article.order || 0 }, deletedAt: null },
          orderBy: { order: 'desc' },
          select: { id: true, title: true }
        }),
        prisma.article.findFirst({
          where: { collectionId: article.collectionId, order: { gt: article.order || 0 }, deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true, title: true }
        }),
        prisma.collection.findUnique({
          where: { id: article.collectionId },
          select: {
            id: true, title: true, totalChapters: true, completedChapters: true, readingProgress: true,
            articles: {
                select: { id: true, title: true, progress: true, order: true },
                orderBy: { order: 'asc' }
            }
          }
        })
      ]);
      return { prev, next, collection };
  })();

  const [article, navigation] = await Promise.all([articlePromise, navigationPromise]);

  return (
    <Suspense fallback={
       <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
         <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
       </div>
    }>
      <ReaderClient 
        initialArticle={{
          ...article,
          lastRead: article.updatedAt ? new Date(article.updatedAt).getTime() : Date.now(),
          title: article.title || '',
          domain: article.domain || undefined,
          url: article.url || undefined,
          type: (article.type as 'text' | 'markdown') || 'markdown',
          collectionId: article.collectionId || undefined,
          order: article.order || undefined,
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
          content: article.content || undefined,
          html: article.html || undefined,
          // Convert nulls to undefined for other fields if needed
        }}
        initialCollection={navigation?.collection as any}
      />
    </Suspense>
  );
}
