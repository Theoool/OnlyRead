import { useQuery } from '@tanstack/react-query';
import { SessionAPI, Session, SessionFilters } from '@/lib/api/sessions';

/**
 * useSession - 获取单个会话
 */
export function useSession(sessionId?: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => SessionAPI.get(sessionId!),
    enabled: !!sessionId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * useSessions - 获取会话列表
 */
export function useSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => SessionAPI.list(filters),
    staleTime: 10000, // 10 seconds
  });
}

/**
 * useSessionStats - 获取会话统计
 */
export function useSessionStats() {
  const { data: sessions, isLoading } = useSessions();

  const stats = {
    total: sessions?.length || 0,
    active: sessions?.filter(s => s.status === 'ACTIVE').length || 0,
    archived: sessions?.filter(s => s.status === 'ARCHIVED').length || 0,
    completed: sessions?.filter(s => s.status === 'COMPLETED').length || 0,
    byType: {
      LEARNING: sessions?.filter(s => s.type === 'LEARNING').length || 0,
      COPILOT: sessions?.filter(s => s.type === 'COPILOT').length || 0,
      QA: sessions?.filter(s => s.type === 'QA').length || 0,
    },
  };

  return { stats, isLoading };
}

