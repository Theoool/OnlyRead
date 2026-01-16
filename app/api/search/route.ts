import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
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

    // Parallel search execution
    const { concepts, articles } = await searchCloud(searchTerm, type, limit)

    // Sort by relevance
    concepts.sort((a, b) => b.relevanceScore - a.relevanceScore)
    articles.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return NextResponse.json({
      concepts: concepts.slice(0, limit),
      articles: articles.slice(0, limit),
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
            tags: true,
            reviewCount: true,
            nextReviewDate: true,
            createdAt: true,
            sourceArticleId: true,
          },
        })
      : Promise.resolve([]),
    shouldSearchArticles
      ? prisma.article.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { domain: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limit,
          select: {
            id: true,
            title: true,
            type: true,
            domain: true,
            progress: true,
            createdAt: true,
            content: true, // Needed for snippet generation
          },
        })
      : Promise.resolve([]),
  ])

  // Process results
  const concepts = dbConcepts.map((concept: any) => {
    const relevanceScore = calculateRelevance(concept, query)
    const snippet = createSnippet(concept.myDefinition || '', query)

    return {
      ...concept,
      relevanceScore,
      snippet,
      source: 'cloud',
    }
  })

  const articles = dbArticles.map((article: any) => {
    const relevanceScore = calculateArticleRelevance(article, query)
    const snippet = createSnippet(article.content || '', query)
    const contentLower = article.content || ''
    const occurrences = (contentLower.match(new RegExp(escapeRegExp(query), 'gi')) || []).length

    return {
      ...article,
      relevanceScore,
      occurrences,
      snippet,
      source: 'cloud',
    }
  })

  return { concepts, articles }
}

// Helper: Calculate relevance score for concepts
function calculateRelevance(concept: any, query: string): number {
  const queryLower = query.toLowerCase()
  let score = 0

  if (concept.term?.toLowerCase().includes(queryLower)) score += 10
  if (concept.myDefinition?.toLowerCase().includes(queryLower)) score += 3
  if (concept.myExample?.toLowerCase().includes(queryLower)) score += 1

  return score
}

// Helper: Calculate relevance score for articles
function calculateArticleRelevance(article: any, query: string): number {
  const queryLower = query.toLowerCase()
  let score = 0

  if (article.title?.toLowerCase().includes(queryLower)) score += 5
  if (article.content?.toLowerCase().includes(queryLower)) score += 1

  return score
}

// Helper: Create highlighted snippet
function createSnippet(text: string, searchTerm: string, maxLength = 150): string {
  if (!text) return ''

  const index = text.toLowerCase().indexOf(searchTerm.toLowerCase())
  if (index === -1) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  const start = Math.max(0, index - maxLength / 2)
  const end = Math.min(text.length, index + searchTerm.length + maxLength / 2)
  let snippet = text.substring(start, end)

  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'

  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi')
  snippet = snippet.replace(regex, '**$1**')

  return snippet
}

// Helper: Escape RegExp special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
