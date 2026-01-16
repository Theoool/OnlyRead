import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

// POST - Advanced search with multiple filters
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      query,
      filters = {},
      sortBy = 'relevance',
      limit = 20,
    } = body

    const where: any = {
      userId: user.id,
      deletedAt: null,
    }

    // Text search query
    if (query && query.trim()) {
      const searchTerm = query.trim()
      where.OR = [
        { term: { contains: searchTerm, mode: 'insensitive' } },
        { myDefinition: { contains: searchTerm, mode: 'insensitive' } },
        { myExample: { contains: searchTerm, mode: 'insensitive' } },
        { aiDefinition: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Tag filters
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      }
    }

    // Date range filter
    if (filters.dateRange) {
      const { start, end } = filters.dateRange
      if (start) {
        where.createdAt = { ...where.createdAt, gte: new Date(start) }
      }
      if (end) {
        where.createdAt = { ...where.createdAt, lte: new Date(end) }
      }
    }

    // Mastery level filter
    if (filters.masteryLevel && filters.masteryLevel.length > 0) {
      const masteryConditions = []

      if (filters.masteryLevel.includes('new')) {
        masteryConditions.push({ reviewCount: 0 })
      }

      if (filters.masteryLevel.includes('learning')) {
        masteryConditions.push({
          reviewCount: { gt: 0 },
          interval: { lt: 7 },
        })
      }

      if (filters.masteryLevel.includes('mature')) {
        masteryConditions.push({
          interval: { gte: 7 },
          OR: [
            { nextReviewDate: null },
            { nextReviewDate: { gte: new Date() } },
          ],
        })
      }

      if (filters.masteryLevel.includes('lapsed')) {
        masteryConditions.push({
          nextReviewDate: { lt: new Date() },
        })
      }

      if (masteryConditions.length > 0) {
        where.OR = masteryConditions
      }
    }

    // Minimum review count filter
    if (filters.minReviewCount) {
      where.reviewCount = { gte: filters.minReviewCount }
    }

    // Confidence filter
    if (filters.minConfidence) {
      where.confidence = { gte: filters.minConfidence }
    }

    // Source article filter
    if (filters.sourceArticleId) {
      where.sourceArticleId = filters.sourceArticleId
    }

    // Determine sort order
    let orderBy: any = {}
    switch (sortBy) {
      case 'name':
        orderBy = { term: 'asc' }
        break
      case 'recent':
        orderBy = { createdAt: 'desc' }
        break
      case 'reviews':
        orderBy = { reviewCount: 'desc' }
        break
      case 'interval':
        orderBy = { interval: 'desc' }
        break
      case 'relevance':
      default:
        // For relevance, we'll sort manually after fetching
        orderBy = { createdAt: 'desc' }
        break
    }

    // Fetch concepts
    let concepts = await prisma.concept.findMany({
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

    // Manual relevance scoring if needed
    if (sortBy === 'relevance' && query) {
      const searchTerm = query.toLowerCase()
      concepts = concepts.map((concept: any) => {
        let score = 0
        if (concept.term.toLowerCase().includes(searchTerm)) score += 10
        if ((concept.myDefinition || '').toLowerCase().includes(searchTerm)) score += 3
        if ((concept.myExample || '').toLowerCase().includes(searchTerm)) score += 1

        return {
          ...concept,
          relevanceScore: score,
        }
      }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
    }

    // Get total count (without limit)
    const totalCount = await prisma.concept.count({ where })

    return NextResponse.json({
      concepts,
      total: totalCount,
      returned: concepts.length,
      query,
      filters,
      sortBy,
    })
  } catch (error: any) {
    console.error('Advanced search error:', error)
    return NextResponse.json(
      { error: error.message || 'Advanced search failed' },
      { status: 500 }
    )
  }
}
