/**
 * Articles API - Cloud-first data layer
 * All article operations go through the API
 */

import { get, post, put, del } from '@/lib/infrastructure/api/client'

export interface ConceptCardData {
  term: string
  myDefinition: string
  myExample: string
  myConnection: string
  confidence: number
  createdAt: number
}

export interface Article {
  id: string
  title: string
  domain?: string
  url?: string
  content?: string
  html?: string
  type?: 'text' | 'markdown'
  progress: number
  lastRead: number
  lastReadSentence?: number
  conceptCards?: ConceptCardData[]
  totalBlocks?: number
  completedBlocks?: number
  totalReadingTime?: number
  createdAt?: string
  updatedAt?: string
  collectionId?: string
  order?: number
}

interface ArticlesResponse {
  articles: Article[]
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  }
}

interface ArticleResponse {
  article: Article
}

/**
 * Fetch all articles for the current user with pagination
 */
export async function getArticles(options: {
  page?: number;
  pageSize?: number;
  limit?: number; // Deprecated
  type?: string;
} = {}): Promise<{ articles: Article[]; pagination?: ArticlesResponse['pagination'] }> {
  const { page = 1, pageSize, limit, type } = options;
  const finalPageSize = pageSize || limit || 20;

  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: finalPageSize.toString(),
  });

  if (type) {
    params.append('type', type);
  }

  const response = await get<ArticlesResponse>(`/api/articles?${params.toString()}`)
  return {
    articles: response.articles || [],
    pagination: response.pagination,
  }
}

/**
 * Fetch a single article by ID
 */
export async function getArticle(id: string): Promise<Article | undefined> {
  try {
    const response = await get<{ article: any }>(`/api/articles?id=${id}`)
    const article = response.article

    // Transform API response to match interface
    return {
      id: article.id,
      title: article.title || '',
      domain: article.domain || undefined,
      url: article.url || undefined,
      content: article.content || undefined,
      html: article.html || undefined,
      type: article.type as 'text' | 'markdown' || 'markdown',
      progress: article.progress || 0,
      lastRead: article.updatedAt ? new Date(article.updatedAt).getTime() : Date.now(),
      lastReadSentence: article.currentPosition || undefined,
      totalBlocks: article.totalBlocks || undefined,
      completedBlocks: article.completedBlocks || undefined,
      totalReadingTime: article.totalReadingTime || undefined,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      collectionId: article.collectionId || undefined,  // ✅ Include collectionId
      order: article.order || undefined,  // ✅ Include order
    }
  } catch (error) {
    console.error('Failed to get article:', error)
    return undefined
  }
}

/**
 * Create a new article
 */
export async function createArticle(article: Partial<Article>): Promise<Article> {
  // Map frontend field names to database field names
  const dbData: any = {
    ...article,
  }

  // Map lastReadSentence -> currentPosition
  if (article.lastReadSentence !== undefined) {
    dbData.currentPosition = article.lastReadSentence
    delete dbData.lastReadSentence
  }

  // Remove lastRead (not a database field)
  if (dbData.lastRead) {
    delete dbData.lastRead
  }

  const response = await post<ArticleResponse>('/api/articles', dbData)
  return response.article
}

/**
 * Update an existing article
 */
export async function updateArticle(
  id: string,
  data: Partial<Article>
): Promise<Article> {
  // Map frontend field names to database field names
  const dbData: any = {
    id,
    ...data,
  }

  // Map lastReadSentence -> currentPosition
  if (data.lastReadSentence !== undefined) {
    dbData.currentPosition = data.lastReadSentence
    delete dbData.lastReadSentence
  }

  // Remove lastRead (not a database field, updatedAt is used instead)
  if (dbData.lastRead) {
    delete dbData.lastRead
  }

  const response = await put<ArticleResponse>('/api/articles', dbData)
  return response.article
}

/**
 * Delete an article (soft delete)
 */
export async function deleteArticle(id: string): Promise<void> {
  await del<void>(`/api/articles?id=${id}`)
}

/**
 * Save or update article (upsert)
 */
export async function saveArticle(article: Article): Promise<Article> {
  const existing = await getArticle(article.id)

  if (existing) {
    return updateArticle(article.id, article)
  } else {
    return createArticle(article)
  }
}
