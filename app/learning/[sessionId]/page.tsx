import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { SessionClientPage } from './SessionClientPage';

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Fetch session with messages
  const session = await prisma.learningSession.findFirst({
    where: { 
      id: sessionId, 
      userId: user.id 
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!session) {
    notFound();
  }

  // Fetch articles and collections for context selector
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

  // Transform messages to CopilotWidget format
  const initialMessages = session.messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content || '',
    ui: m.ui || undefined,
    sources: Array.isArray(m.sources) ? m.sources as any[] : undefined,
    createdAt: m.createdAt.toISOString()
  }));

  // Extract context from session
  const sessionContext = session.context as Record<string, any> | null;
  const context = {
    articleIds: sessionContext?.articleIds || [],
    collectionId: sessionContext?.collectionId
  };

  return (
    <SessionClientPage 
      sessionId={sessionId}
      sessionTitle={session.title || '新会话'}
     
      context={context}
      articles={articles}
      collections={collections}
    />
  );
}
