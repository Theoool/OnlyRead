/**
 * Concept Store - Cloud-first architecture
 * Uses Zustand for state management without localStorage persistence
 * All data is fetched from and saved to the API
 */

import { create } from 'zustand'
import * as conceptsAPI from '@/lib/core/learning/concepts.service'

export interface ConceptData {
  id?: string
  term: string
  myDefinition: string
  myExample: string
  myConnection?: string
  confidence: number
  aiDefinition?: string
  aiExample?: string
  aiRelatedConcepts?: string[]
  isAiCollected?: boolean
  createdAt: number
  sourceArticleId?: string
  lastReviewedAt?: number
  reviewCount?: number
  nextReviewDate?: number
  easeFactor?: number
  interval?: number
  tags?: string[]
}

// Export Concept as an alias for ConceptData for compatibility
export type Concept = ConceptData;

interface ConceptStore {
  // State
  concepts: Record<string, ConceptData>
  loading: boolean
  error: string | null

  // Actions
  loadConcepts: () => Promise<void>
  addConcept: (concept: ConceptData) => Promise<void>
  removeConcept: (term: string, id?: string) => Promise<void>
  updateConcept: (term: string, data: Partial<ConceptData>, id?: string) => Promise<void>
  getConcept: (term: string) => ConceptData | undefined
  importConcepts: (concepts: ConceptData[]) => Promise<void>
  findRelatedConcepts: (text: string) => Promise<Array<{ id: string; term: string; similarity: number }>>
  clearError: () => void
}

export const useConceptStore = create<ConceptStore>((set, get) => ({
  // Initial state
  concepts: {},
  loading: false,
  error: null,

  // Load all concepts from API
  loadConcepts: async () => {
    set({ loading: true, error: null })
    try {
      const concepts = await conceptsAPI.getConcepts()

      // Convert array to record keyed by term
      const conceptsRecord: Record<string, ConceptData> = {}
      concepts.forEach((concept) => {
        if (concept.term) {
          conceptsRecord[concept.term] = concept
        }
      })

      set({ concepts: conceptsRecord, loading: false })
    } catch (error: any) {
      console.error('Failed to load concepts:', error)
      set({
        error: error.message || 'Failed to load concepts',
        loading: false,
      })
    }
  },

  // Add a new concept
  addConcept: async (concept) => {
    set({ loading: true, error: null })
    try {
      const created = await conceptsAPI.createConcept(concept)

      set((state) => ({
        concepts: {
          ...state.concepts,
          [created.term]: created,
        },
        loading: false,
      }))
    } catch (error: any) {
      console.error('Failed to add concept:', error)
      set({
        error: error.message || 'Failed to add concept',
        loading: false,
      })
      throw error
    }
  },

  // Remove a concept
  removeConcept: async (term, id) => {
    set({ loading: true, error: null })
    try {
      // If we have an ID, use it; otherwise try to find it in state
      const conceptId = id || get().concepts[term]?.id

      if (!conceptId) {
        throw new Error('Concept ID not found')
      }

      await conceptsAPI.deleteConcept(conceptId)

      set((state) => {
        const newConcepts = { ...state.concepts }
        delete newConcepts[term]
        return { concepts: newConcepts, loading: false }
      })
    } catch (error: any) {
      console.error('Failed to remove concept:', error)
      set({
        error: error.message || 'Failed to remove concept',
        loading: false,
      })
      throw error
    }
  },

  // Update a concept
  updateConcept: async (term, data, id) => {
    set({ loading: true, error: null })
    try {
      // If we have an ID, use it; otherwise try to find it in state
      const conceptId = id || get().concepts[term]?.id

      if (!conceptId) {
        throw new Error('Concept ID not found')
      }

      const updated = await conceptsAPI.updateConcept(conceptId, data)

      set((state) => ({
        concepts: {
          ...state.concepts,
          [term]: updated,
        },
        loading: false,
      }))
    } catch (error: any) {
      console.error('Failed to update concept:', error)
      set({
        error: error.message || 'Failed to update concept',
        loading: false,
      })
      throw error
    }
  },

  // Get a concept from state
  getConcept: (term) => {
    return get().concepts[term]
  },

  // Import concepts (merge with existing)
  importConcepts: async (newConcepts) => {
    set({ loading: true, error: null })
    try {
      // Filter concepts that don't exist yet
      const existing = get().concepts
      const toCreate = newConcepts.filter((c) => !existing[c.term])

      if (toCreate.length === 0) {
        set({ loading: false })
        return
      }

      await conceptsAPI.importConcepts(toCreate)

      // Reload all concepts to get the complete list
      await get().loadConcepts()
    } catch (error: any) {
      console.error('Failed to import concepts:', error)
      set({
        error: error.message || 'Failed to import concepts',
        loading: false,
      })
    }
  },

  // Find related concepts using vector search
  findRelatedConcepts: async (text) => {
    try {
      // 使用 GET 请求，语义更清晰
      const params = new URLSearchParams({
        text: text.substring(0, 500), // 限制文本长度
        limit: '5',
        threshold: '0.7',
      });

      const res = await fetch(`/api/concepts/related?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to fetch related concepts');
      }

      const data = await res.json();
      return data.related || [];
    } catch (error) {
      console.error('❌ Failed to find related concepts:', error);
      return [];
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}))
