import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, password, fullName } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Sign up user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create user profile in our database
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: authData.user.email!,
        fullName: fullName || authData.user.user_metadata?.full_name,
        avatarUrl: authData.user.user_metadata?.avatar_url,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
