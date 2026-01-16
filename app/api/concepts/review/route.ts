import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { calculateSRS } from '@/lib/srs'
import { NextResponse } from 'next/server'

// POST - Submit review and update SRS
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conceptId, quality } = await req.json()

    if (!conceptId || quality === undefined) {
      return NextResponse.json(
        { error: 'Concept ID and quality are required' },
        { status: 400 }
      )
    }

    // Get concept
    const concept = await prisma.concept.findFirst({
      where: { id: conceptId, userId: user.id, deletedAt: null },
    })

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      )
    }

    // Calculate SRS updates
    const srsUpdates = calculateSRS({
      term: concept.term,
      myDefinition: concept.myDefinition,
      myExample: concept.myExample,
      confidence: concept.confidence,
      createdAt: concept.createdAt.getTime(),
      interval: concept.interval,
      easeFactor: concept.easeFactor ? Number(concept.easeFactor) : 2.5,
      reviewCount: concept.reviewCount,
    }, quality)

    // Update concept
    const { lastReviewedAt, nextReviewDate, createdAt, term, myDefinition, myExample, myConnection, sourceArticleId, tags, ...updates } = srsUpdates;
    const updatedConcept = await prisma.concept.update({
      where: { id: conceptId },
      data: {
        lastReviewedAt: new Date(),
        reviewCount: { increment: 1 },
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : undefined,
        ...updates,
      },
    })

    // Record review history
    await prisma.reviewHistory.create({
      data: {
        conceptId,
        userId: user.id,
        quality,
        interval: srsUpdates.interval || concept.interval,
        easeFactor: srsUpdates.easeFactor || concept.easeFactor,
      },
    })

    return NextResponse.json({ concept: updatedConcept })
  } catch (error: any) {
    console.error('Review concept error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to review concept' },
      { status: 500 }
    )
  }
}
