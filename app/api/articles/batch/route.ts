import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST - Batch import articles (for migration)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { articles } = await req.json()

    if (!Array.isArray(articles)) {
      return NextResponse.json(
        { error: 'Articles must be an array' },
        { status: 400 }
      )
    }

    // Batch create articles
    const result = await prisma.article.createMany({
      data: articles.map(a => ({
        id: a.id,
        userId: user.id,
        title: a.title || null,
        content: a.content,
        type: a.type || 'markdown',
        url: a.url || null,
        domain: a.domain || null,
        progress: a.progress || 0,
        currentPosition: a.currentPosition || 0,
        totalBlocks: a.totalBlocks || 0,
        completedBlocks: a.completedBlocks || 0,
        totalReadingTime: a.totalReadingTime || 0,
        createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success: true,
      count: result.count,
    })
  } catch (error: any) {
    console.error('Batch import articles error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import articles' },
      { status: 500 }
    )
  }
}
