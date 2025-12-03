import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ConceptData {
  term: string;
  myDefinition: string;
  myExample: string;
  myConnection?: string;
  confidence: number;
  createdAt: number;
  sourceArticleId?: string;
  lastReviewedAt?: number;
  reviewCount?: number;
  nextReviewDate?: number; // SRS
  easeFactor?: number; // SRS
  interval?: number; // SRS
}

interface ConceptStore {
  concepts: Record<string, ConceptData>;
  
  // Actions
  addConcept: (concept: ConceptData) => void;
  removeConcept: (term: string) => void;
  updateConcept: (term: string, data: Partial<ConceptData>) => void;
  getConcept: (term: string) => ConceptData | undefined;
  importConcepts: (concepts: ConceptData[]) => void;
}

export const useConceptStore = create<ConceptStore>()(
  persist(
    (set, get) => ({
      concepts: {},

      addConcept: (concept) => 
        set((state) => ({
          concepts: {
            ...state.concepts,
            [concept.term]: {
              ...concept,
              // If it exists, merge/update, or keep creation date? 
              // We'll overwrite for now but preserve creation date if needed.
              createdAt: state.concepts[concept.term]?.createdAt || concept.createdAt,
              reviewCount: (state.concepts[concept.term]?.reviewCount || 0) + 1,
              lastReviewedAt: Date.now(),
            }
          }
        })),

      removeConcept: (term) =>
        set((state) => {
          const newConcepts = { ...state.concepts };
          delete newConcepts[term];
          return { concepts: newConcepts };
        }),

      updateConcept: (term, data) =>
        set((state) => ({
          concepts: {
            ...state.concepts,
            [term]: { ...state.concepts[term], ...data }
          }
        })),

      getConcept: (term) => get().concepts[term],
      
      importConcepts: (newConcepts) =>
        set((state) => {
            const merged = { ...state.concepts };
            newConcepts.forEach(c => {
                if (!merged[c.term]) {
                    merged[c.term] = c;
                }
            });
            return { concepts: merged };
        }),
    }),
    {
      name: 'concept-storage', // unique name
      storage: createJSONStorage(() => localStorage),
    }
  )
);
