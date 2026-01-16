import { prisma } from '@/lib/infrastructure/database/prisma';
import { Prisma } from '@/lib/generated/prisma';

export class StatsRepository {
  /**
   * Get aggregated reading stats for a user
   */
  static async getReadingStats(userId: string) {
    return prisma.readingStats.findUnique({
      where: { userId }
    });
  }

  /**
   * Create or update reading stats
   */
  static async upsertReadingStats(userId: string, data: Omit<Prisma.ReadingStatsCreateInput, 'user'>) {
    return prisma.readingStats.upsert({
      where: { userId },
      create: {
        ...data,
        user: { connect: { id: userId } }
      },
      update: data
    });
  }

  /**
   * Create a new reading session
   */
  static async createSession(data: Omit<Prisma.ReadingSessionCreateInput, 'user' | 'article'> & { userId: string, articleId: string }) {
    const { userId, articleId, ...rest } = data;
    return prisma.readingSession.create({
      data: {
        ...rest,
        user: { connect: { id: userId } },
        article: { connect: { id: articleId } }
      }
    });
  }

  /**
   * Get reading sessions in a date range
   */
  static async getSessionsInRange(userId: string, startDate: Date, endDate: Date) {
    return prisma.readingSession.findMany({
      where: {
        userId,
        startedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        durationSeconds: true,
        blocksCompleted: true,
        conceptsCreated: true,
        startedAt: true
      },
      orderBy: { startedAt: 'asc' }
    });
  }

  static async incrementStats(userId: string, increments: { duration: number, sessions: number }) {
    return prisma.readingStats.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        totalReadingTime: BigInt(increments.duration),
        totalSessions: increments.sessions,
        totalArticles: 0,
        currentStreak: 1,
        longestStreak: 1
      },
      update: {
        totalReadingTime: { increment: BigInt(increments.duration) },
        totalSessions: { increment: increments.sessions }
      }
    });
  }
  static async calculateStats(userId: string) {
    const [totalArticles, totalReadingTimeResult, totalSessions] = await Promise.all([
      prisma.article.count({ where: { userId, deletedAt: null } }),
      prisma.readingSession.aggregate({
        where: { userId },
        _sum: { durationSeconds: true }
      }),
      prisma.readingSession.count({ where: { userId } })
    ]);

    // Calculate streaks (simplified version)
    // For a real production app, this should be more robust
    const sessions = await prisma.readingSession.findMany({
      where: { userId },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
      distinct: ['startedAt'] // This might not work as expected with timestamps, need date truncation
    });
    
    // Process streaks in memory for now
    const currentStreak = 0;
    const longestStreak = 0;
    // ... logic implementation in service
    
    return {
      totalArticles,
      totalReadingTime: totalReadingTimeResult._sum.durationSeconds || 0,
      totalSessions,
      currentStreak,
      longestStreak
    };
  }
}
