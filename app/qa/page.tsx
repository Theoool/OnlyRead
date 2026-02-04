import { createClient } from '@/lib/supabase/server';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { CollectionsRepository } from '@/lib/core/reading/collections.repository';
import QAClientPage from './ClientPage';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function QAPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch data for the context selector
  const [articlesResult, collections] = await Promise.all([
    ArticlesRepository.findAll(user.id, { page: 1, pageSize: 50 }),
    CollectionsRepository.findAll(user.id)
  ]);

  // Serialize data to avoid "Plain Object" warnings with Dates
  const articles = articlesResult.items.map(item => ({
    id: item.id,
    title: item.title || 'Untitled',
    domain: item.domain,
    collectionId: item.collectionId,
    createdAt: item.createdAt.toISOString(),
  }));

  const serializedCollections = collections.map(c => ({
    id: c.id,
    title: c.title,
    type: c.type,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <QAClientPage 
      articles={articles}
      collections={serializedCollections}
    />
  );
}
