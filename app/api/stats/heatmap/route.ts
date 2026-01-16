import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Fetch review heatmap data (GitHub-style)
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '365') // Default to 1 year

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    // Fetch review history grouped by date
    const reviewHistory = await prisma.reviewHistory.groupBy({
      by: ['reviewedAt'],
      where: {
        userId: user.id,
        reviewedAt: { gte: startDate },
      },
      _count: {
        reviewedAt: true,
      },
      orderBy: { reviewedAt: 'asc' },
    })

    // Create heatmap data
    const heatmapMap = new Map<string, number>()

    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      heatmapMap.set(dateStr, 0)
    }

    // Fill in actual counts
    reviewHistory.forEach((item) => {
      const dateStr = new Date(item.reviewedAt).toISOString().split('T')[0]
      const currentCount = heatmapMap.get(dateStr) || 0
      heatmapMap.set(dateStr, currentCount + 1)
    })

    // Convert to array and sort
    const heatmap = Array.from(heatmapMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate statistics
    const activeDays = heatmap.filter(d => d.count > 0).length
    const totalReviews = heatmap.reduce((sum, d) => sum + d.count, 0)
    const avgReviewsPerDay = activeDays > 0 ? Math.round((totalReviews / activeDays) * 10) / 10 : 0

    // Find max for color scaling
    const maxReviews = Math.max(...heatmap.map(d => d.count), 1)

    return NextResponse.json({
      heatmap,
      totalDays: days,
      activeDays,
      totalReviews,
      avgReviewsPerDay,
      maxReviews,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Heatmap stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch heatmap data' },
      { status: 500 }
    )
  }
}
