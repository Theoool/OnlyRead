import { ConceptData } from "@/lib/store/useConceptStore";

// SuperMemo 2 Algorithm Simplified
export function calculateSRS(concept: ConceptData, quality: number): Partial<ConceptData> {
  // Quality: 0-5 (0: Blackout, 5: Perfect)
  // We map user feedback "Forgot"(1), "Hard"(2), "Good"(4), "Easy"(5)
  
  const prevInterval = concept.interval || 0;
  const prevEase = concept.easeFactor || 2.5;
  let repetitions = concept.reviewCount || 0;

  let nextInterval = 0;
  let nextEase = prevEase;

  if (quality < 3) {
    // Forgot
    repetitions = 0;
    nextInterval = 1; // Review tomorrow
  } else {
    // Remembered
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(prevInterval * prevEase);
    }
    repetitions += 1;
  }

  // Update Ease Factor
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  nextEase = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEase < 1.3) nextEase = 1.3; // Minimum cap

  const nextReviewDate = Date.now() + nextInterval * 24 * 60 * 60 * 1000;

  return {
    interval: nextInterval,
    easeFactor: nextEase,
    reviewCount: repetitions,
    lastReviewedAt: Date.now(),
    nextReviewDate: nextReviewDate
  };
}
