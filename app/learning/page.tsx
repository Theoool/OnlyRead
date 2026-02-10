import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { LearningClientPage } from './LearningClientPage';

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Fetch user's learning sessions
  const sessions = await prisma.learningSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });

  // Fetch user's articles and collections for new session creation
  const [dbArticles, dbCollections] = await Promise.all([
    prisma.article.findMany({
      where: { 
        userId: user.id,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        domain: true,
        collectionId: true
      }
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true
      }
    })
  ]);

  // Transform to ContextSelector compatible format
  const articles = dbArticles.map(a => ({
    id: a.id,
    title: a.title || '(无标题)',
    domain: a.domain || undefined,
    collectionId: a.collectionId || undefined
  }));

  const collections = dbCollections.map(c => ({
    id: c.id,
    title: c.title,
    type: 'collection'
  }));

  return (
    <LearningClientPage 
      sessions={sessions} 
      articles={articles}
      collections={collections}
    />
  );
}
