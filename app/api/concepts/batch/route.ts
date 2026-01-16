import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

// POST - Batch import concepts (for migration)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { concepts } = await req.json()

    if (!Array.isArray(concepts)) {
      return NextResponse.json(
        { error: 'Concepts must be an array' },
        { status: 400 }
      )
    }

    // Batch create concepts
    const result = await prisma.concept.createMany({
      data: concepts.map(c => ({
        userId: user.id,
        term: c.term,
        myDefinition: c.myDefinition,
        myExample: c.myExample,
        myConnection: c.myConnection || null,
        confidence: c.confidence || 3,
        aiDefinition: c.aiDefinition || null,
        aiExample: c.aiExample || null,
        aiRelatedConcepts: c.aiRelatedConcepts || [],
        sourceArticleId: c.sourceArticleId || null,
        isAiCollected: c.isAiCollected || false,
        tags: c.tags || [],
        createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
        lastReviewedAt: c.lastReviewedAt ? new Date(c.lastReviewedAt) : null,
        reviewCount: c.reviewCount || 0,
        nextReviewDate: c.nextReviewDate ? new Date(c.nextReviewDate) : null,
        easeFactor: c.easeFactor || 2.5,
        interval: c.interval || 0,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success: true,
      count: result.count,
    })
  } catch (error: any) {
    console.error('Batch import concepts error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import concepts' },
      { status: 500 }
    )
  }
}
