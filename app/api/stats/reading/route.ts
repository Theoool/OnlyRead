import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Fetch reading progress analysis
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d, all

    // Calculate date range
    const now = new Date()
    let startDate = new Date(0)
    if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }

    // Fetch reading sessions and articles in parallel
    const [sessions, articles, completedArticles] = await Promise.all([
      // Reading sessions in period
      prisma.readingSession.findMany({
        where: {
          userId: user.id,
          startedAt: { gte: startDate },
        },
        select: {
          durationSeconds: true,
          blocksCompleted: true,
          conceptsCreated: true,
          startedAt: true,
        },
        orderBy: { startedAt: 'asc' },
      }),

      // All articles (for total stats)
      prisma.article.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        select: {
          content: true,
          totalReadingTime: true,
          progress: true,
          createdAt: true,
        },
      }),

      // Completed articles in period
      prisma.article.count({
        where: {
          userId: user.id,
          deletedAt: null,
          progress: { gte: 99 },
          createdAt: { gte: startDate },
        },
      }),
    ])

    // Calculate period statistics
    const periodReadingTime = sessions.reduce((sum, s) => sum + s.durationSeconds, 0)
    const periodMinutes = Math.round(periodReadingTime / 60)
    const periodPagesRead = sessions.reduce((sum, s) => sum + (s.blocksCompleted || 0), 0)
    const periodConceptsCreated = sessions.reduce((sum, s) => sum + (s.conceptsCreated || 0), 0)

    // Calculate daily breakdown
    const dailyMap = new Map<string, { minutes: number; articles: number; concepts: number }>()
    const days = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      dailyMap.set(dateStr, { minutes: 0, articles: 0, concepts: 0 })
    }

    sessions.forEach((session) => {
      const dateStr = new Date(session.startedAt).toISOString().split('T')[0]
      const current = dailyMap.get(dateStr) || { minutes: 0, articles: 0, concepts: 0 }
      current.minutes += Math.round(session.durationSeconds / 60)
      current.articles += session.blocksCompleted > 0 ? 1 : 0
      current.concepts += session.conceptsCreated || 0
      dailyMap.set(dateStr, current)
    })

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate overall statistics
    const totalArticles = articles.length
    const totalCompletedArticles = articles.filter(a => (a.progress || 0) >= 99).length

    // Estimate reading speed (characters per minute)
    const totalChars = articles.reduce((sum, a) => sum + (a.content?.length || 0), 0)
    const totalReadingTimeAll = articles.reduce((sum, a) => sum + (a.totalReadingTime || 0), 0)
    const avgReadingSpeed = totalReadingTimeAll > 0
      ? Math.round(totalChars / (totalReadingTimeAll / 1000 / 60))
      : 0

    // Active reading days in period
    const activeDays = sessions.length > 0
      ? new Set(sessions.map(s => new Date(s.startedAt).toISOString().split('T')[0])).size
      : 0

    return NextResponse.json({
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],

      // Period stats
      periodMinutes,
      periodPagesRead,
      periodConceptsCreated,
      completedArticlesInPeriod: completedArticles,
      activeDays,

      // Overall stats
      totalArticles,
      totalCompletedArticles,
      avgReadingSpeed,

      // Daily breakdown
      dailyBreakdown,

      // Averages
      avgMinutesPerDay: activeDays > 0 ? Math.round(periodMinutes / activeDays) : 0,
      avgArticlesPerDay: activeDays > 0 ? Math.round((completedArticles / activeDays) * 10) / 10 : 0,

      generatedAt: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Reading stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reading statistics' },
      { status: 500 }
    )
  }
}
