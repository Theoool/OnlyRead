/**
 * SRS (Spaced Repetition System) - 间隔重复系统
 * 基于 SuperMemo SM-2 算法
 */

interface ConceptData {
  term: string;
  myDefinition?: string | null;
  myExample?: string | null;
  confidence?: number | null;
  createdAt: number;
  interval: number;
  easeFactor: number;
  reviewCount: number;
}

interface SRSResult {
  interval: number;
  easeFactor: number;
  confidence: number;
  nextReviewDate: number;
  term: string;
  myDefinition?: string | null;
  myExample?: string | null;
  myConnection?: string | null;
  sourceArticleId?: string | null;
  tags?: string[];
  createdAt: number;
  lastReviewedAt: number;
}

/**
 * 计算 SRS 更新
 * @param concept - 概念数据
 * @param quality - 回答质量 (0-5)
 *   0: 完全不记得
 *   1: 错误的回答
 *   2: 错误的回答，但记得一些
 *   3: 正确但困难
 *   4: 正确且犹豫
 *   5: 完全正确
 */
export function calculateSRS(concept: ConceptData, quality: number): SRSResult {
  let { interval, easeFactor, reviewCount } = concept;
  
  // 确保 quality 在有效范围内
  quality = Math.max(0, Math.min(5, quality));
  
  // 如果回答质量低于 3，重置间隔
  if (quality < 3) {
    interval = 1;
  } else {
    // 根据复习次数计算新间隔
    if (reviewCount === 0) {
      interval = 1;
    } else if (reviewCount === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }
  
  // 更新难度系数 (ease factor)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // 确保难度系数不低于 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }
  
  // 计算置信度 (0-100)
  const confidence = Math.round((quality / 5) * 100);
  
  // 计算下次复习日期
  const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;
  
  return {
    interval,
    easeFactor: Number(easeFactor.toFixed(2)),
    confidence,
    nextReviewDate,
    term: concept.term,
    myDefinition: concept.myDefinition,
    myExample: concept.myExample,
    createdAt: concept.createdAt,
    lastReviewedAt: Date.now(),
  };
}

