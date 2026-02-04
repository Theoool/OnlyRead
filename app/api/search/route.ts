import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding'
import { API_CONFIG } from '@/lib/config/constants'
import { devCache } from '@/lib/infrastructure/cache/dev-cache'

// Cached embedding wrapper
async function getCachedEmbedding(text: string): Promise<number[]> {
  const cacheKey = `embedding:${text}`;
  const cached = devCache.get<number[]>(cacheKey);
  if (cached) return cached;

  const embedding = await generateEmbedding(text);
  devCache.set(cacheKey, embedding, 3600 * 1000); // Cache for 1 hour
  return embedding;
}

// GET - Full-text search across concepts and articles
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // all, concepts, articles
    const limit = parseInt(searchParams.get('limit') || String(API_CONFIG.DEFAULT_SEARCH_LIMIT))
    const useVector = searchParams.get('vector') !== 'false' // Default to true

    // Get User ID from header (fastest) or Supabase (fallback)
    let userId = req.headers.get('x-user-id');
    if (!userId) {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
    }

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { concepts, articles } = await searchCloud(searchTerm, type, limit, useVector, userId)

    // Sort by relevance
    // Combine keyword matches and semantic matches
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
async function searchCloud(query: string, type: string, limit: number, useVector: boolean, userId: string) {
  const shouldSearchConcepts = type === 'all' || type === 'concepts'
  const shouldSearchArticles = type === 'all' || type === 'articles'

  let queryVector: number[] | null = null
  if (useVector) {
    try {
      queryVector = await getCachedEmbedding(query)
    } catch (e) {
      console.warn('Failed to generate embedding for search query:', e)
    }
  }

  // Execute queries in parallel
  const [dbConcepts, dbArticles, vectorConcepts, vectorArticles] = await Promise.all([
    // 1. Keyword Search - Concepts
    shouldSearchConcepts
      ? prisma.concept.findMany({
        where: {
          userId: userId,
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

    // 2. Keyword Search - Articles
    shouldSearchArticles
      ? prisma.article.findMany({
        where: {
          userId: userId,
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { domain: { contains: query, mode: 'insensitive' } },
            {
              body: {
                content: { contains: query, mode: 'insensitive' }
              }
            }
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
          body: {
            select: {
              content: true
            }
          }
        },
      })
      : Promise.resolve([]),

    // 3. Vector Search - Concepts
    (shouldSearchConcepts && queryVector)
      ? prisma.$queryRaw<any[]>`
          SELECT 
            id, term, "my_definition" as "myDefinition", "my_example" as "myExample", 
            confidence, "review_count" as "reviewCount", "next_review_date" as "nextReviewDate", 
            "created_at" as "createdAt", "source_article_id" as "sourceArticleId",
            1 - (embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) as similarity
          FROM concepts
          WHERE user_id = ${userId}::uuid
            AND deleted_at IS NULL
            AND 1 - (embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) > ${API_CONFIG.VECTOR_SIMILARITY_THRESHOLD}
          ORDER BY similarity DESC
          LIMIT ${limit};
        `
      : Promise.resolve([]),

    // 4. Vector Search - Articles
    (shouldSearchArticles && queryVector)
      ? prisma.$queryRaw<any[]>`
          SELECT 
            a.id, a.title, a.type, a.domain, a.progress, a."created_at" as "createdAt",
            b.content,
            1 - (a.embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) as similarity
          FROM articles a
          LEFT JOIN article_bodies b ON a.id = b.article_id
          WHERE a.user_id = ${userId}::uuid
            AND a.deleted_at IS NULL
            AND 1 - (a.embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) > ${API_CONFIG.VECTOR_SIMILARITY_THRESHOLD}
          ORDER BY similarity DESC
          LIMIT ${limit};
        `
      : Promise.resolve([])
  ])

  // Process and Merge Concepts
  const conceptMap = new Map<string, any>()

  // Add keyword results first
  dbConcepts.forEach((c: any) => {
    conceptMap.set(c.id, {
      ...c,
      relevanceScore: calculateRelevance(c, query),
      snippet: createSnippet(c.myDefinition || '', query),
      source: 'keyword'
    })
  })

  // Merge vector results
  vectorConcepts.forEach((c: any) => {
    const existing = conceptMap.get(c.id)
    const vectorScore = (c.similarity * 10) // Normalize similarity (0-1) to score (0-10)

    if (existing) {
      // Boost existing keyword match
      existing.relevanceScore += vectorScore
      existing.source = 'hybrid'
    } else {
      conceptMap.set(c.id, {
        ...c,
        relevanceScore: vectorScore,
        snippet: createSnippet(c.myDefinition || '', query), // Might not have keyword hit
        source: 'vector'
      })
    }
  })

  // Process and Merge Articles
  const articleMap = new Map<string, any>()

  // Add keyword results
  dbArticles.forEach((a: any) => {
    const content = a.body?.content || ''
    const { body, ...rest } = a

    articleMap.set(a.id, {
      ...rest,
      relevanceScore: calculateArticleRelevance({ ...rest, content }, query),
      snippet: createSnippet(content, query),
      occurrences: (content.toLowerCase().match(new RegExp(escapeRegExp(query), 'gi')) || []).length,
      source: 'keyword'
    })
  })

  // Merge vector results
  vectorArticles.forEach((a: any) => {
    const existing = articleMap.get(a.id)
    const vectorScore = (a.similarity * 5) // Normalize

    if (existing) {
      existing.relevanceScore += vectorScore
      existing.source = 'hybrid'
    } else {
      articleMap.set(a.id, {
        ...a,
        relevanceScore: vectorScore,
        snippet: createSnippet(a.content || '', query),
        occurrences: 0,
        source: 'vector'
      })
    }
  })

  return {
    concepts: Array.from(conceptMap.values()),
    articles: Array.from(articleMap.values())
  }
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
