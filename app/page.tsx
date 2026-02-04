import ClientHome from './ClientHome';
import { createClient } from '@/lib/supabase/server';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { CollectionsRepository } from '@/lib/core/reading/collections.repository';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <ClientHome />;
  }

  const [articlesResult, collections] = await Promise.all([
    ArticlesRepository.findAll(user.id, { page: 1, pageSize: 20 }),
    CollectionsRepository.findAll(user.id)
  ]);

  return (
    <ClientHome 
      initialArticles={articlesResult.items.map(item => ({
        ...item,
        lastRead: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
        // Map other fields if necessary or ensure types match
        title: item.title || '',
        type: (item.type as 'text' | 'markdown') || 'markdown',
        domain: item.domain || undefined,
        url: item.url || undefined,
        collectionId: item.collectionId || undefined,
        order: item.order || undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }))} 
      initialCollections={collections.map(c => ({
        ...c,
        description: c.description || undefined,
        cover: c.cover || undefined,
        createdAt: c.createdAt.toISOString(),
         updatedAt: c.updatedAt.toISOString(),
         totalWords: Number(c.totalWords) || null, // BigInt handling
         type: c.type as 'SERIES' | 'BOOK' | 'COURSE',
         readingProgress: c.readingProgress ?? undefined,
       }))}
     />
  );
}
