import { describe, it, expect } from 'vitest';
import { calculateSRS } from '../srs';
import { ConceptData } from '../store/useConceptStore';

describe('SRS Algorithm (SuperMemo-2)', () => {
  // Helper to create a fresh concept
  const createConcept = (): ConceptData => ({
    id: 'test-id',
    term: 'Test Term',
    myDefinition: 'Test Def',
    myExample: 'Test Ex',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reviewCount: 0,
    interval: 0,
    easeFactor: 2.5,
    lastReviewedAt: 0,
    nextReviewDate: 0,
    isAiCollected: false,
    tags: []
  });

  it('should initialize a new card correctly on first review (Good quality)', () => {
    const concept = createConcept();
    const result = calculateSRS(concept, 4); // Quality 4: Good

    expect(result.interval).toBe(1); // First interval is always 1
    expect(result.reviewCount).toBe(1);
    expect(result.easeFactor).toBe(2.5); // Initial EF shouldn't change much
  });

  it('should schedule second review for 6 days later if quality is good', () => {
    const concept = createConcept();
    // Simulate first review passed
    concept.reviewCount = 1;
    concept.interval = 1;
    
    const result = calculateSRS(concept, 4);

    expect(result.interval).toBe(6); // SM-2 standard: 1 -> 6
    expect(result.reviewCount).toBe(2);
  });

  it('should increase interval exponentially for subsequent reviews', () => {
    const concept = createConcept();
    // Simulate multiple reviews
    concept.reviewCount = 2;
    concept.interval = 6;
    concept.easeFactor = 2.5;

    const result = calculateSRS(concept, 4);

    // 6 * 2.5 = 15
    expect(result.interval).toBe(15);
  });

  it('should reset interval if user forgets (Quality < 3)', () => {
    const concept = createConcept();
    concept.reviewCount = 5;
    concept.interval = 100;
    
    const result = calculateSRS(concept, 2); // Quality 2: Hard/Forgot

    expect(result.interval).toBe(1); // Reset to 1 day
    expect(result.reviewCount).toBe(0); // Reset repetitions logic (simplified version)
  });

  it('should decrease ease factor when review is hard', () => {
    const concept = createConcept();
    concept.easeFactor = 2.5;
    
    const result = calculateSRS(concept, 3); // Quality 3: Hard but passed

    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    // q=3 -> 5-3=2
    // 0.1 - 2 * (0.08 + 2 * 0.02) = 0.1 - 2 * 0.12 = 0.1 - 0.24 = -0.14
    // New EF = 2.5 - 0.14 = 2.36
    expect(result.easeFactor).toBeCloseTo(2.36);
  });

  it('should not let ease factor drop below 1.3', () => {
    const concept = createConcept();
    concept.easeFactor = 1.3;
    
    const result = calculateSRS(concept, 3); // Hard, should decrease

    expect(result.easeFactor).toBe(1.3); // Cap at 1.3
  });
});
