import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get counts from database
    const [conceptsCount, articlesCount] = await Promise.all([
      prisma.concept.count({
        where: { userId: user.id, deletedAt: null },
      }),
      prisma.article.count({
        where: { userId: user.id, deletedAt: null },
      }),
    ])

    return NextResponse.json({
      concepts: conceptsCount,
      articles: articlesCount,
    })
  } catch (error: any) {
    console.error('Migration status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get migration status' },
      { status: 500 }
    )
  }
}
