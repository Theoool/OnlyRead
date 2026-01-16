import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Sign in user with Supabase Auth

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      )
    }

    if (!authData.user) {
      
      return NextResponse.json(
        { error: 'Failed to sign in' },
        { status: 500 }
      )
    }

    // Get user from our database
    const user = await prisma.user.findUnique({
      where: { id: authData.user.id },
    })

    if (!user) {
      // Create user profile if it doesn't exist
      const newUser = await prisma.user.create({
        data: {
          id: authData.user.id,
          email: authData.user.email!,
          fullName: authData.user.user_metadata?.full_name,
          avatarUrl: authData.user.user_metadata?.avatar_url,
        },
      })

      return NextResponse.json({
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
        },
      })
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    })
  } catch (error: any) {
    console.error('Signin error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
