/**
 * Concept Store - Cloud-first architecture
 * Uses Zustand for state management without localStorage persistence
 * All data is fetched from and saved to the API
 */

import { create } from 'zustand'
import * as conceptsAPI from '@/lib/api/concepts'

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

  // Clear error
  clearError: () => set({ error: null }),
}))
