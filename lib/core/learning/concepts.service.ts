  /**
 * Concepts API - Cloud-first data layer
 * All concept operations go through the API
 */

import { get, post, put, del } from '@/lib/infrastructure/api/client'

export interface ConceptData {
  id?: string
  term: string
  myDefinition: string
  myExample: string
  myConnection?: string
  confidence: number
  createdAt: number
  sourceArticleId?: string
  lastReviewedAt?: number
  reviewCount?: number
  nextReviewDate?: number
  easeFactor?: number
  interval?: number
  tags?: string[]
}

interface ConceptsResponse {
  concepts: ConceptData[]
}

interface ConceptResponse {
  concept: ConceptData
}

/**
 * Fetch all concepts for the current user
 */
export async function getConcepts(options?: {
  due?: boolean
  limit?: number
}): Promise<ConceptData[]> {
  const params = new URLSearchParams()
  if (options?.due) params.set('due', 'true')
  if (options?.limit) params.set('limit', options.limit.toString())

  const response = await get<ConceptsResponse>(`/api/concepts?${params.toString()}`)
  return response.concepts || []
}

/**
 * Fetch a single concept by term
 */
export async function getConcept(term: string): Promise<ConceptData | undefined> {
  try {
    const concepts = await getConcepts()
    return concepts.find((c) => c.term === term)
  } catch {
    return undefined
  }
}

/**
 * Batch fetch concepts by terms
 * Optimized for checking which concepts exist in the reading content
 */
export async function getConceptsByTerms(terms: string[]): Promise<ConceptData[]> {
  if (!terms.length) return []

  const response = await post<{ concepts: ConceptData[] }>('/api/concepts/by-terms', {
    terms: terms.slice(0, 50), // Limit to 50 terms per request
  })
  return response.concepts || []
}

/**
 * Filter concepts with advanced criteria
 */
export async function filterConcepts(params: {
  tags?: string[]
  mastered?: boolean | 'all'
  due?: boolean
  limit?: number
  sortBy?: 'recent' | 'name' | 'interval' | 'reviews'
}): Promise<{
  concepts: ConceptData[]
  total: number
  appliedFilters: any
  availableTags: string[]
}> {
  const query = new URLSearchParams()
  if (params.tags?.length) query.set('tags', params.tags.join(','))
  if (params.mastered !== undefined && params.mastered !== 'all') {
    query.set('mastered', String(params.mastered))
  }
  if (params.due) query.set('due', 'true')
  if (params.limit) query.set('limit', String(params.limit))
  if (params.sortBy) query.set('sortBy', params.sortBy)

  return get<any>(`/api/concepts/filter?${query.toString()}`)
}

/**
 * Check if a concept exists by term
 */
export async function checkConceptExists(term: string): Promise<{ exists: boolean; concept?: ConceptData }> {
  try {
    const response = await get<{ exists: boolean; concept?: ConceptData }>(`/api/concepts/by-terms?term=${encodeURIComponent(term)}`)
    return { exists: response.exists, concept: response.concept }
  } catch {
    return { exists: false }
  }
}

/**
 * Create a new concept
 */
export async function createConcept(concept: Omit<ConceptData, 'id'>): Promise<ConceptData> {
  const response = await post<ConceptResponse>('/api/concepts', concept)
  return response.concept
}

/**
 * Update an existing concept
 */
export async function updateConcept(
  id: string,
  data: Partial<ConceptData>
): Promise<ConceptData> {
  const response = await put<ConceptResponse>('/api/concepts', { id, ...data })
  return response.concept
}

/**
 * Delete a concept (soft delete)
 */
export async function deleteConcept(id: string): Promise<void> {
  await del<void>(`/api/concepts?id=${id}`)
}


/**
 * Batch import concepts
 */
export async function importConcepts(
  concepts: Omit<ConceptData, 'id'>[]
): Promise<{ created: number; updated: number }> {
  const response = await post<{ created: number; updated: number }>(
    '/api/concepts/batch',
    { concepts }
  )
  return response
}
