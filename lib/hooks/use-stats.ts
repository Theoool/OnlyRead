'use client'

import { useQuery } from '@tanstack/react-query'

interface LearningStats {
  totalReadingTime: number
  totalConcepts: number
  totalArticles: number
  completedArticles: number
  totalReviews: number
  avgSessionDuration: number
  currentStreak: number
  longestStreak: number
}

interface MasteryStats {
  distribution: {
    new: number
    learning: number
    mature: number
    lapsed: number
  }
  totalCards: number
  masteryRate: number
  dueCount: number
  breakdown: {
    new: { count: number; percentage: number }
    learning: { count: number; percentage: number }
    mature: { count: number; percentage: number }
    lapsed: { count: number; percentage: number }
  }
}

interface HeatmapData {
  heatmap: Array<{ date: string; count: number }>
  totalDays: number
  activeDays: number
  totalReviews: number
  avgReviewsPerDay: number
  maxReviews: number
}

import { useReadingStats } from './use-reading-stats'

/**
 * 获取学习统计数据
 * @deprecated Use useReadingStats instead
 */
export function useLearningStats(period: '7d' | '30d' | '90d' | 'all' = '7d') {
  const { data, ...rest } = useReadingStats(period);
  
  const learningStats: LearningStats | undefined = data ? {
    totalReadingTime: data.totalReadingTime * 1000, // Convert seconds to ms to match old API
    totalConcepts: data.periodConceptsCreated, // Note: this might be different semantics
    totalArticles: data.totalArticles,
    completedArticles: data.completedArticlesInPeriod || 0,
    totalReviews: 0, // Not available in reading stats
    avgSessionDuration: 0, // Not available
    currentStreak: data.currentStreak,
    longestStreak: data.longestStreak
  } : undefined;

  return { data: learningStats, ...rest };
}

/**
 * 获取掌握程度统计
 */
export function useMasteryStats() {
  return useQuery({
    queryKey: ['stats', 'mastery'],
    queryFn: async () => {
      const res = await fetch('/api/stats/mastery', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch mastery stats')
      return res.json() as Promise<MasteryStats>
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    retry: 1,
  })
}

/**
 * 获取热力图数据
 */
export function useHeatmapData(days: number = 90) {
  return useQuery({
    queryKey: ['stats', 'heatmap', days],
    queryFn: async () => {
      const res = await fetch(`/api/stats/heatmap?days=${days}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch heatmap data')
      return res.json() as Promise<HeatmapData>
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    retry: 1,
  })
}

/**
 * 组合hook - 获取所有统计数据
 */
export function useAllStats(days: number = 90) {
  const learningQuery = useLearningStats()
  const masteryQuery = useMasteryStats()
  const heatmapQuery = useHeatmapData(days)

  return {
    learning: learningQuery.data,
    mastery: masteryQuery.data,
    heatmap: heatmapQuery.data,
    isLoading: learningQuery.isLoading || masteryQuery.isLoading || heatmapQuery.isLoading,
    error: learningQuery.error || masteryQuery.error || heatmapQuery.error,
    refetch: () => {
      learningQuery.refetch()
      masteryQuery.refetch()
      heatmapQuery.refetch()
    },
  }
}
