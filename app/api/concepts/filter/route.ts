import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET - Filter concepts by tags and other criteria
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tagsParam = searchParams.get('tags') // comma-separated
    const masteredParam = searchParams.get('mastered') // true, false, or all
    const dueForReview = searchParams.get('due') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'recent' // recent, name, interval, reviews

    const where: any = {
      userId: user.id,
      deletedAt: null,
    }

    // Filter by tags
    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim())
      where.tags = {
        hasSome: tags,
      }
    }

    // Filter by mastery level
    if (masteredParam === 'true') {
      // Mature: interval >= 7 days and not overdue
      where.interval = { gte: 7 }
      where.OR = [
        { nextReviewDate: null },
        { nextReviewDate: { gte: new Date() } },
      ]
    } else if (masteredParam === 'false') {
      // Not mature: interval < 7 days OR overdue
      where.OR = [
        { interval: { lt: 7 } },
        {
          interval: { gte: 7 },
          nextReviewDate: { lt: new Date() },
        },
      ]
    }

    // Filter by due for review
    if (dueForReview) {
      where.OR = [
        { nextReviewDate: null },
        { nextReviewDate: { lte: new Date() } },
      ]
    }

    // Determine sort order
    let orderBy: any = {}
    switch (sortBy) {
      case 'name':
        orderBy = { term: 'asc' }
        break
      case 'interval':
        orderBy = { interval: 'desc' }
        break
      case 'reviews':
        orderBy = { reviewCount: 'desc' }
        break
      case 'recent':
      default:
        orderBy = { createdAt: 'desc' }
        break
    }

    // Fetch filtered concepts
    const concepts = await prisma.concept.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        term: true,
        myDefinition: true,
        myExample: true,
        myConnection: true,
        confidence: true,
        tags: true,
        sourceArticleId: true,
        createdAt: true,
        updatedAt: true,
        lastReviewedAt: true,
        reviewCount: true,
        nextReviewDate: true,
        easeFactor: true,
        interval: true,
      },
    })

    // Get all unique tags for filter suggestions
    const allConcepts = await prisma.concept.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      select: {
        tags: true,
      },
    })

    const allTags = new Set<string>()
    allConcepts.forEach((concept: any) => {
      concept.tags.forEach((tag: string) => allTags.add(tag))
    })

    const appliedFilters = {
      tags: tagsParam ? tagsParam.split(',').map(t => t.trim()) : [],
      mastered: masteredParam || null,
      dueForReview,
      sortBy,
    }

    return NextResponse.json({
      concepts,
      total: concepts.length,
      appliedFilters,
      availableTags: Array.from(allTags).sort(),
    })
  } catch (error: any) {
    console.error('Filter concepts error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to filter concepts' },
      { status: 500 }
    )
  }
}
