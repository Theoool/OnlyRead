import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

   
    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Try to get user from database
    let user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        subscriptionType: true,

        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            concepts: {
              where: { deletedAt: null },
            },
            articles: {
              where: { deletedAt: null },
            },
            reviewHistory: true,
          },
        },
      },
    })

    // If user doesn't exist in database, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: authUser.id,
          email: authUser.email!,
          fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          avatarUrl: authUser.user_metadata?.avatar_url,
          subscriptionType: 'free',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          subscriptionType: true,
         
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              concepts: {
                where: { deletedAt: null },
              },
              articles: {
                where: { deletedAt: null },
              },
              reviewHistory: true,
            },
          },
        },
      })
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
