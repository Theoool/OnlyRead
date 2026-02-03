import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'
import { devCache, cacheKeys } from '@/lib/infrastructure/cache/dev-cache'

// GET - Fetch overall learning statistics
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'all' // all, week, month

    // Skip cache for warmup requests to keep data fresh
    const isWarmup = req.headers.get('x-warmup') === 'true'
    const cacheKey = cacheKeys.stats(user.id, period)

    // Try cache first (shorter TTL for warmup)
    if (!isWarmup) {
      const cached = devCache.get(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    // Calculate date range
    const now = new Date()
    let startDate = new Date(0)
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Fetch all data in parallel for performance
    const [
      totalConcepts,
      totalArticles,
      totalReviews,
      readingStats,
      reviewHistory,
    ] = await Promise.all([
      // Total concepts
      prisma.concept.count({
        where: {
          userId: user.id,
          deletedAt: null,
        }, 
      }),

      // Total articles
      prisma.article.count({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      }),

      // Total reviews in period

      prisma.reviewHistory.count({
        where: {
          userId: user.id,
          reviewedAt: { gte: startDate },
        },
      }),

      // Reading stats aggregation
      prisma.readingSession.aggregate({
        where: {
          userId: user.id,
          startedAt: { gte: startDate },
        },
        _sum: {
          durationSeconds: true,
        },
        _count: {
          _all: true,
        },
      }),

      // Review history for streak calculation
      prisma.reviewHistory.findMany({
        where: {
          userId: user.id,
          reviewedAt: { gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) }, // Last year
        },
        select: {
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'desc' },
      }),
    ])

    // Calculate total reading time
    const totalReadingTime = (readingStats._sum.durationSeconds || 0) * 1000

    // Calculate average session duration
    const sessionCount = readingStats._count._all
    const avgSessionDuration = sessionCount > 0
      ? Math.round(totalReadingTime / sessionCount)
      : 0

    // Calculate streak
    const currentStreak = calculateStreak(reviewHistory.map(h => h.reviewedAt))
    const longestStreak = calculateLongestStreak(reviewHistory.map(h => h.reviewedAt))

    // Count completed articles
    const completedArticles = await prisma.article.count({
      where: {
        userId: user.id,
        deletedAt: null,
        progress: { gte: 99 },
      },
    })

    const response = {
      period,
      totalReadingTime,
      totalConcepts,
      totalArticles,
      completedArticles,
      totalReviews,
      avgSessionDuration,
      currentStreak,
      longestStreak,
      generatedAt: now.toISOString(),
    }

    // Cache the response (3 second TTL for dev)
    devCache.set(cacheKey, response, 3000)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Learning stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch learning statistics' },
      { status: 500 }
    )
  }
}

// Helper: Calculate current streak (consecutive days)
function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get unique dates
  const uniqueDates = Array.from(
    new Set(
      dates.map(d => {
        const date = new Date(d)
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
    )
  ).sort((a, b) => b - a) // Sort descending

  let streak = 0
  let currentDate = today

  for (const dateTimestamp of uniqueDates) {
    const date = new Date(dateTimestamp)
    const diffDays = Math.floor((currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0 || diffDays === 1) {
      streak++
      currentDate = date
    } else {
      break
    }
  }

  return streak
}

// Helper: Calculate longest streak
function calculateLongestStreak(dates: Date[]): number {
  if (dates.length === 0) return 0

  // Get unique dates and sort ascending
  const uniqueDates = Array.from(
    new Set(
      dates.map(d => {
        const date = new Date(d)
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
    )
  ).sort((a, b) => a - b)

  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1])
    const currDate = new Date(uniqueDates[i])
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else if (diffDays > 1) {
      currentStreak = 1
    }
  }

  return maxStreak
}
