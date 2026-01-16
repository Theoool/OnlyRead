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
 * Submit a review for a concept
 */
export async function submitReview(
  conceptId: string,
  quality: number
): Promise<ConceptData> {
  const response = await post<ConceptResponse>('/api/concepts/review', {
    conceptId,
    quality,
  })
  return response.concept
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
