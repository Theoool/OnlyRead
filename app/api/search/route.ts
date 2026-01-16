import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

// GET - Full-text search across concepts and articles
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // all, concepts, articles
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        concepts: [],
        articles: [],
        total: 0,
        query: '',
      })
    }

    const searchTerm = query.trim()
    const { concepts, articles } = await searchCloud(searchTerm, type, limit)

    return NextResponse.json({
      concepts,
      articles,
      total: concepts.length + articles.length,
      query,
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    )
  }
}

// Search in cloud database
async function searchCloud(query: string, type: string, limit: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { concepts: [], articles: [] }
  }

  const shouldSearchConcepts = type === 'all' || type === 'concepts'
  const shouldSearchArticles = type === 'all' || type === 'articles'

  // Execute queries in parallel
  const [dbConcepts, dbArticles] = await Promise.all([
    shouldSearchConcepts
      ? prisma.concept.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            OR: [
              { term: { contains: query, mode: 'insensitive' } },
              { myDefinition: { contains: query, mode: 'insensitive' } },
              { myExample: { contains: query, mode: 'insensitive' } },
              { aiDefinition: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limit,
          select: {
            id: true,
            term: true,
            myDefinition: true,
            myExample: true,
            confidence: true,
            // tags: true, // Tags is now a relation, need include or different select strategy if we want names
            reviewCount: true,
            nextReviewDate: true,
            createdAt: true,
            sourceArticleId: true,
          },
        })
      : Promise.resolve([]),
    shouldSearchArticles
      ? prisma.$queryRaw`
          SELECT 
            a.id, 
            a.title, 
            a.type, 
            a.domain, 
            a.progress, 
            a.created_at as "createdAt",
            ts_rank(a."searchVector", websearch_to_tsquery('simple', ${query})) as "relevanceScore",
            ts_headline('simple', b.content, websearch_to_tsquery('simple', ${query}), 'StartSel=**,StopSel=**') as snippet
          FROM articles a
          JOIN article_bodies b ON a.id = b.article_id
          WHERE a.user_id = ${user.id}::uuid
            AND a.deleted_at IS NULL
            AND a."searchVector" @@ websearch_to_tsquery('simple', ${query})
          ORDER BY "relevanceScore" DESC
          LIMIT ${limit}
        `
      : Promise.resolve([]),
  ])

  // Process results
  const concepts = (dbConcepts as any[]).map((concept: any) => ({
    ...concept,
    relevanceScore: 10, // Simple default for now
    snippet: concept.myDefinition?.substring(0, 150),
    source: 'cloud',
  }))

  const articles = (dbArticles as any[]).map((article: any) => ({
    ...article,
    occurrences: 0, // Removed regex counting
    source: 'cloud',
  }))

  return { concepts, articles }
}
