import ReaderClient from './ReaderClient';
import { createClient } from '@/lib/supabase/server';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { getArticleNavigation } from '@/app/actions/article';
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

  // Fetch article and navigation in parallel through proper Server Actions
  const [article, navigation] = await Promise.all([
    ArticlesRepository.findById(id, user.id),
    getArticleNavigation(id) // Use Server Action instead of client fetch
  ]);

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
         
        }}
        initialCollection={navigation?.collection as any}
      />
    </Suspense>
  );
}
