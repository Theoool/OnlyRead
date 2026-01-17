import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

// POST - Sync local data to cloud
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { dryRun = false } = body

    // Read local data from request body
    const { articles, concepts } = body

    if (!articles && !concepts) {
      return NextResponse.json(
        { error: 'No data to sync. Please provide articles or concepts.' },
        { status: 400 }
      )
    }

    const results: any = {
      articles: { synced: 0, errors: 0, skipped: 0 },
      concepts: { synced: 0, errors: 0, skipped: 0 },
      dryRun,
    }

    // Sync articles
    if (articles && Array.isArray(articles)) {
      for (const article of articles) {
        try {
          // Check if article already exists
          const existing = await prisma.article.findFirst({
            where: {
              userId: user.id,
              id: article.id,
              deletedAt: null,
            },
          })

          if (existing) {
            results.articles.skipped++
          } else if (!dryRun) {
            await prisma.article.create({
              data: {
                id: article.id,
                userId: user.id,
                title: article.title || null,
           
                type: article.type || 'markdown',
                url: article.url || null,
                domain: article.domain || null,
                progress: article.progress || 0,
                totalBlocks: 0,
                completedBlocks: 0,
              },
            })
            results.articles.synced++
          } else {
            results.articles.synced++
          }
        } catch (error) {
          console.error('Failed to sync article:', article.id, error)
          results.articles.errors++
        }
      }
    }

    // Sync concepts
    if (concepts && Array.isArray(concepts)) {
      for (const concept of concepts) {
        try {
          // Check if concept already exists
          const existing = await prisma.concept.findFirst({
            where: {
              userId: user.id,
              term: concept.term,
              deletedAt: null,
            },
          })

          if (existing) {
            results.concepts.skipped++
          } else if (!dryRun) {
            await prisma.concept.create({
              data: {
                userId: user.id,
                term: concept.term,
                myDefinition: concept.myDefinition,
                myExample: concept.myExample,
                myConnection: concept.myConnection || null,
                confidence: concept.confidence || 3,
                sourceArticleId: concept.sourceArticleId || null,
             
                interval: concept.interval || 0,
                easeFactor: concept.easeFactor || 2.5,
                reviewCount: concept.reviewCount || 0,
                nextReviewDate: concept.nextReviewDate
                  ? new Date(concept.nextReviewDate)
                  : null,
                lastReviewedAt: concept.lastReviewedAt
                  ? new Date(concept.lastReviewedAt)
                  : null,
                createdAt: concept.createdAt
                  ? new Date(concept.createdAt)
                  : new Date(),
              },
            })
            results.concepts.synced++
          } else {
            results.concepts.synced++
          }
        } catch (error) {
          console.error('Failed to sync concept:', concept.term, error)
          results.concepts.errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: dryRun
        ? 'Dry run completed. No data was actually synced.'
        : 'Data synced successfully.',
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}

// GET - Get sync status
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get cloud counts
    const [cloudConcepts, cloudArticles] = await Promise.all([
      prisma.concept.count({
        where: { userId: user.id, deletedAt: null },
      }),
      prisma.article.count({
        where: { userId: user.id, deletedAt: null },
      }),
    ])

    return NextResponse.json({
      cloud: {
        concepts: cloudConcepts,
        articles: cloudArticles,
      },
      status: 'ok',
    })
  } catch (error: any) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
