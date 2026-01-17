import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { StatsService } from '@/lib/core/reading/stats.service';

export const GET = apiHandler(async (req) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') as '7d' | '30d' | '90d' | 'all') || '7d';

  // Get aggregated stats (fast)
  const overallStats = await StatsService.getReadingStats(user.id);
  const longestSession = await StatsService.getLongestSessionDuration(user.id);

  // Get period stats (calculated)
  const periodStats = await StatsService.getPeriodStats(user.id, period);

  return createSuccessResponse({
    ...periodStats,
    totalArticles: overallStats.totalArticles,
    totalReadingTime: Number(overallStats.totalReadingTime), // Convert BigInt to number
    totalSessions: overallStats.totalSessions,
    currentStreak: overallStats.currentStreak,
    longestStreak: overallStats.longestStreak,
    longestSessionSeconds: longestSession,
  });
});

export const POST = apiHandler(async (req) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  const json = await req.json();
  const { articleId, duration, blocksCompleted, conceptsCreated } = json;

  if (!articleId || typeof duration !== 'number') {
    throw new Error('Invalid request body');
  }

  await StatsService.recordSession(user.id, {
    articleId,
    durationSeconds: Math.floor(duration / 1000), // Convert ms to seconds if input is ms, assuming input is ms from legacy
    blocksCompleted: blocksCompleted || 0,
    conceptsCreated: conceptsCreated || 0
  });

  return createSuccessResponse({ success: true });
});
