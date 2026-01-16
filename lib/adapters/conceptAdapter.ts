import { useAuthStore } from '@/lib/store/useAuthStore';
import { Concept } from '@/lib/store/useConceptStore';

/**
 * Concept Data Adapter
 * Automatically switches between localStorage and API based on auth mode
 */

export class ConceptAdapter {
  /**
   * Get all concepts
   */
  static async getConcepts(): Promise<Record<string, Concept>> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      return this.getConceptsFromAPI();
    }

    return this.getConceptsFromLocal();
  }

  /**
   * Get concepts from localStorage
   */
  private static getConceptsFromLocal(): Record<string, Concept> {
    if (typeof window === 'undefined') return {};

    const stored = localStorage.getItem('concepts');
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Get concepts from API
   */
  private static async getConceptsFromAPI(): Promise<Record<string, Concept>> {
    try {
      const res = await fetch('/api/concepts');
      if (!res.ok) throw new Error('Failed to fetch concepts');

      const data = await res.json();
      const concepts: Record<string, Concept> = {};

      data.concepts.forEach((concept: any) => {
        concepts[concept.id] = {
          id: concept.id,
          userId: concept.userId,
          term: concept.term,
          myDefinition: concept.myDefinition,
          myExample: concept.myExample,
          myConnection: concept.myConnection,
          confidence: concept.confidence,
          aiDefinition: concept.aiDefinition,
          aiExample: concept.aiExample,
          aiRelatedConcepts: concept.aiRelatedConcepts,
          sourceArticleId: concept.sourceArticleId,
          isAiCollected: concept.isAiCollected,
          createdAt: new Date(concept.createdAt).getTime(),
          lastReviewedAt: concept.lastReviewedAt ? new Date(concept.lastReviewedAt).getTime() : null,
          reviewCount: concept.reviewCount,
          nextReviewDate: concept.nextReviewDate ? new Date(concept.nextReviewDate).getTime() : null,
          easeFactor: parseFloat(concept.easeFactor),
          interval: concept.interval,
          tags: concept.tags || [],
        };
      });

      // Update localStorage as cache
      localStorage.setItem('concepts', JSON.stringify(concepts));

      return concepts;
    } catch (error) {
      console.error('Error fetching concepts from API:', error);
      // Fallback to localStorage
      return this.getConceptsFromLocal();
    }
  }

  /**
   * Save a concept
   */
  static async saveConcept(concept: Concept): Promise<Concept> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      return this.saveConceptToAPI(concept);
    }

    return this.saveConceptToLocal(concept);
  }

  /**
   * Save concept to localStorage
   */
  private static saveConceptToLocal(concept: Concept): Concept {
    if (typeof window === 'undefined') return concept;

    const concepts = this.getConceptsFromLocal();
    concepts[concept.id] = concept;
    localStorage.setItem('concepts', JSON.stringify(concepts));

    return concept;
  }

  /**
   * Save concept to API
   */
  private static async saveConceptToAPI(concept: Concept): Promise<Concept> {
    try {
      const payload = {
        id: concept.id,
        term: concept.term,
        myDefinition: concept.myDefinition,
        myExample: concept.myExample,
        myConnection: concept.myConnection,
        confidence: concept.confidence,
        aiDefinition: concept.aiDefinition,
        aiExample: concept.aiExample,
        aiRelatedConcepts: concept.aiRelatedConcepts,
        sourceArticleId: concept.sourceArticleId,
        isAiCollected: concept.isAiCollected,
        lastReviewedAt: concept.lastReviewedAt ? new Date(concept.lastReviewedAt).toISOString() : null,
        reviewCount: concept.reviewCount,
        nextReviewDate: concept.nextReviewDate ? new Date(concept.nextReviewDate).toISOString() : null,
        easeFactor: concept.easeFactor.toString(),
        interval: concept.interval,
        tags: concept.tags,
      };

      const res = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save concept');

      const data = await res.json();

      // Update localStorage cache
      const concepts = this.getConceptsFromLocal();
      concepts[concept.id] = concept;
      localStorage.setItem('concepts', JSON.stringify(concepts));

      return concept;
    } catch (error) {
      console.error('Error saving concept to API:', error);
      // Fallback to localStorage
      return this.saveConceptToLocal(concept);
    }
  }

  /**
   * Delete a concept
   */
  static async deleteConcept(conceptId: string): Promise<void> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      await this.deleteConceptFromAPI(conceptId);
    }

    this.deleteConceptFromLocal(conceptId);
  }

  /**
   * Delete concept from localStorage
   */
  private static deleteConceptFromLocal(conceptId: string): void {
    if (typeof window === 'undefined') return;

    const concepts = this.getConceptsFromLocal();
    delete concepts[conceptId];
    localStorage.setItem('concepts', JSON.stringify(concepts));
  }

  /**
   * Delete concept from API
   */
  private static async deleteConceptFromAPI(conceptId: string): Promise<void> {
    try {
      await fetch(`/api/concepts/${conceptId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting concept from API:', error);
    }
  }

  /**
   * Update concept after review
   */
  static async updateConceptReview(
    conceptId: string,
    quality: number,
    nextReviewDate: Date,
    easeFactor: number,
    interval: number
  ): Promise<void> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      try {
        await fetch(`/api/concepts/${conceptId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quality,
            nextReviewDate: nextReviewDate.toISOString(),
            easeFactor: easeFactor.toString(),
            interval,
          }),
        });
      } catch (error) {
        console.error('Error updating review in API:', error);
      }
    }

    // Always update localStorage
    const concepts = this.getConceptsFromLocal();
    if (concepts[conceptId]) {
      concepts[conceptId].lastReviewedAt = Date.now();
      concepts[conceptId].nextReviewDate = nextReviewDate.getTime();
      concepts[conceptId].easeFactor = easeFactor;
      concepts[conceptId].interval = interval;
      concepts[conceptId].reviewCount += 1;
      localStorage.setItem('concepts', JSON.stringify(concepts));
    }
  }
}
