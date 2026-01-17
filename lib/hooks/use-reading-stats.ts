'use client';

import { useQuery } from '@tanstack/react-query';

export interface ReadingStats {
  period: string;
  startDate: string;
  endDate: string;
  
  // Period metrics
  periodMinutes: number;
  periodPagesRead: number;
  periodConceptsCreated: number;
  completedArticlesInPeriod?: number; // Added
  activeDays: number;
  
  // Overall metrics
  totalArticles: number;
  totalReadingTime: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  longestSessionSeconds?: number;
  
  // Breakdown
  dailyBreakdown: Array<{
    date: string;
    minutes: number;
    articles: number;
    concepts: number;
  }>;
}

export function useReadingStats(period: '7d' | '30d' | '90d' | 'all' = '7d') {
  return useQuery({
    queryKey: ['stats', 'reading', period],
    queryFn: async () => {
      const response = await fetch(`/api/stats/reading?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reading stats');
      }
      return response.json() as Promise<ReadingStats>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
