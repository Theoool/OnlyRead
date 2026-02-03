import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/api/response'
import { requireUserFromHeader } from '@/lib/supabase/user'

// POST - Batch import articles (for migration)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { articles } = await req.json()

    if (!Array.isArray(articles)) {
      return NextResponse.json(
        { error: 'Articles must be an array' },
        { status: 400 }
      )
    }

    // 1. Filter out existing articles to simulate skipDuplicates
    const articleIds = articles.map((a: any) => a.id).filter(Boolean);
    const existingArticles = await prisma.article.findMany({
      where: {
        id: { in: articleIds }
      },
      select: { id: true }
    });
    const existingIds = new Set(existingArticles.map(a => a.id));

    const newArticles = articles.filter((a: any) => !existingIds.has(a.id));

    let createdCount = 0;

    if (newArticles.length > 0) {
      // 2. Use transaction to create articles with bodies (Vertical Partitioning)
      await prisma.$transaction(
        newArticles.map((a: any) =>
          prisma.article.create({
            data: {
              id: a.id,
              userId: user.id,
              title: a.title || null,
              type: a.type || 'markdown',
              url: a.url || null,
              domain: a.domain || null,
              progress: a.progress || 0,
              currentPosition: a.currentPosition || 0,
              totalBlocks: a.totalBlocks || 0,
              // Note: Embedding (Unsupported type) cannot be set directly via Prisma create
              // embedding: a.embedding || null, 
              completedBlocks: a.completedBlocks || 0,
              totalReadingTime: a.totalReadingTime || 0,
              createdAt: a.createdAt ? new Date(a.createdAt) : undefined,

              // Correctly create relation to ArticleBody
              body: {
                create: {
                  content: a.content || '',
                  markdown: a.content || '',
                }
              }
            }
          })
        )
      );
      createdCount = newArticles.length;
    }

    return NextResponse.json({
      success: true,
      count: createdCount,
    })
  } catch (error: any) {
    console.error('Batch import articles error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import articles' },
      { status: 500 }
    )
  }
}

export const GET = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req)
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  const [articles, collections] = await Promise.all([
    // 查询文章
    prisma.article.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit, 
      select: {
        id: true,
        title: true,
        summary: true,
        domain: true,
        type: true,
      }
    }),

    // 查询收藏集 (Books/Series)
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        cover: true,
        type: true,
        _count: {
            select: { articles: true }
        }
      }
    })
  ]);

  // Map to common interface
  const mappedArticles = articles.map(a => ({
    ...a,
    kind: 'article'
  }));

  const mappedCollections = collections.map(c => ({
    ...c,
    kind: 'collection',
    articleCount: c._count.articles
  }));
  
  return createSuccessResponse([...mappedArticles, ...mappedCollections]);
});
