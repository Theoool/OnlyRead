import { StatsRepository } from './stats.repository';

export class StatsService {
  /**
   * Get reading statistics for a user
   * Tries to get cached stats first, falls back to calculation if needed
   */
  static async getReadingStats(userId: string) {
    let stats = await StatsRepository.getReadingStats(userId);

    if (!stats) {
      // Initialize stats if not exist
      const calculated = await StatsRepository.calculateStats(userId);
      stats = await StatsRepository.upsertReadingStats(userId, {
        totalArticles: calculated.totalArticles,
        totalReadingTime: BigInt(calculated.totalReadingTime),
        totalSessions: calculated.totalSessions,
        currentStreak: calculated.currentStreak,
        longestStreak: calculated.longestStreak
      });
    }

    return stats;
  }

  /**
   * Get stats for a specific period (e.g., '7d', '30d')
   * This still needs to query sessions directly as it's a time-window query
   */
  static async getPeriodStats(userId: string, period: '7d' | '30d' | '90d' | 'all') {
    const now = new Date();
    let startDate = new Date(0);
    
    if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const sessions = await StatsRepository.getSessionsInRange(userId, startDate, now);

    // Calculate period specific metrics
    const periodMinutes = Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);
    const periodPagesRead = sessions.reduce((sum, s) => sum + s.blocksCompleted, 0);
    const periodConceptsCreated = sessions.reduce((sum, s) => sum + s.conceptsCreated, 0);

    // Daily breakdown
    const dailyMap = new Map<string, { minutes: number; articles: number; concepts: number }>();
    
    // Initialize days
    const days = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { minutes: 0, articles: 0, concepts: 0 });
    }

    // Fill data
    sessions.forEach(session => {
      const dateStr = new Date(session.startedAt).toISOString().split('T')[0];
      if (dailyMap.has(dateStr)) {
        const current = dailyMap.get(dateStr)!;
        current.minutes += Math.round(session.durationSeconds / 60);
        current.articles += session.blocksCompleted > 0 ? 1 : 0;
        current.concepts += session.conceptsCreated;
      }
    });

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      periodMinutes,
      periodPagesRead,
      periodConceptsCreated,
      dailyBreakdown,
      activeDays: new Set(sessions.map(s => new Date(s.startedAt).toISOString().split('T')[0])).size
    };
  }

  /**
   * Record a reading session
   */
  static async recordSession(userId: string, data: { articleId: string, durationSeconds: number, blocksCompleted: number, conceptsCreated: number }) {
    // 1. Create session
    await StatsRepository.createSession({
      userId,
      articleId: data.articleId,
      durationSeconds: data.durationSeconds,
      blocksCompleted: data.blocksCompleted,
      conceptsCreated: data.conceptsCreated,
      startedAt: new Date(Date.now() - data.durationSeconds * 1000),
      completedAt: new Date()
    });

    // 2. Update aggregate stats
    await StatsRepository.incrementStats(userId, {
        duration: data.durationSeconds,
        sessions: 1
    });
    
    return true;
  }

  static async getLongestSessionDuration(userId: string) {
    return StatsRepository.getLongestSessionDuration(userId);
  }
}
