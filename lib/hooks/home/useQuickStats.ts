import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/hooks/query-keys';

interface QuickStats {
  dueCount: number;
  currentStreak: number;
  totalConcepts: number;
}

export function useQuickStats() {
  return useQuery({
    queryKey: queryKeys.stats.quick(),
    queryFn: async () => {
      const [masteryRes, learningRes] = await Promise.all([
        fetch('/api/stats/mastery', { credentials: 'include' }),
        fetch('/api/stats/learning?period=all', { credentials: 'include' }),
      ]);

      if (!masteryRes.ok || !learningRes.ok) {
        throw new Error('Failed to fetch stats');
      }

      const mastery = await masteryRes.json();
      const learning = await learningRes.json();

      return {
        dueCount: mastery.dueCount || 0,
        currentStreak: learning.currentStreak || 0,
        totalConcepts: learning.totalConcepts || 0,
      } as QuickStats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
