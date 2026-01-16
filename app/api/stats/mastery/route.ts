import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Fetch concept mastery distribution
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all concepts for the user
    const concepts = await prisma.concept.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      select: {
        interval: true,
        nextReviewDate: true,
        reviewCount: true,
        easeFactor: true,
        lastReviewedAt: true,
      },
    })

    const now = new Date()

    // Categorize concepts
    const distribution = {
      new: 0,        // Never reviewed (reviewCount = 0)
      learning: 0,   // interval < 7 days
      mature: 0,     // interval >= 7 days
      lapsed: 0,     // overdue for review
    }

    concepts.forEach((concept) => {
      const interval = concept.interval || 0
      const nextReview = concept.nextReviewDate ? new Date(concept.nextReviewDate) : null
      const reviewCount = concept.reviewCount || 0

      if (reviewCount === 0) {
        distribution.new++
      } else if (nextReview && nextReview < now) {
        distribution.lapsed++
      } else if (interval >= 7) {
        distribution.mature++
      } else {
        distribution.learning++
      }
    })

    const totalCards = concepts.length
    const masteryRate = totalCards > 0
      ? Math.round((distribution.mature / totalCards) * 1000) / 10
      : 0

    // Calculate additional statistics
    const avgEaseFactor = concepts.reduce((sum, c) => {
      return sum + (c.easeFactor ? Number(c.easeFactor) : 2.5)
    }, 0) / (concepts.length || 1)

    const avgReviewCount = concepts.reduce((sum, c) => sum + (c.reviewCount || 0), 0) / (concepts.length || 1)

    // Get concepts due for review
    const dueCount = concepts.filter(c => {
      if (!c.nextReviewDate) return true
      return new Date(c.nextReviewDate) <= now
    }).length

    return NextResponse.json({
      distribution,
      totalCards,
      masteryRate,
      avgEaseFactor: Math.round(avgEaseFactor * 100) / 100,
      avgReviewCount: Math.round(avgReviewCount * 10) / 10,
      dueCount,
      breakdown: {
        new: {
          count: distribution.new,
          percentage: totalCards > 0 ? Math.round((distribution.new / totalCards) * 100) : 0,
        },
        learning: {
          count: distribution.learning,
          percentage: totalCards > 0 ? Math.round((distribution.learning / totalCards) * 100) : 0,
        },
        mature: {
          count: distribution.mature,
          percentage: totalCards > 0 ? Math.round((distribution.mature / totalCards) * 100) : 0,
        },
        lapsed: {
          count: distribution.lapsed,
          percentage: totalCards > 0 ? Math.round((distribution.lapsed / totalCards) * 100) : 0,
        },
      },
      generatedAt: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Mastery stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mastery statistics' },
      { status: 500 }
    )
  }
}
