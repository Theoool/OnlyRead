import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
  
    const supabase = await createClient()

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

  
    if (error) {
      console.error('Session API error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!session) {
      console.log('No session found')
      return NextResponse.json({
        authenticated: false,
        user: null,
      })
    }

    console.log('✅ Session found for user:', session.user.email,)

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
        avatarUrl: session.user.user_metadata?.avatar_url,
      },
      accessToken: session.access_token,
    })
  } catch (error: any) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
