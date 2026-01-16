import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()

    // Log all cookies
    const allCookies = cookieStore.getAll()
    console.log('=== Auth Debug Info ===')
    console.log('All cookies:', allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) })))

    const supabase = await createClient()

    // Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Session error:', sessionError)
    console.log('Session exists:', !!session)
    console.log('Session user:', session?.user)

    // Check user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('User error:', userError)
    console.log('User exists:', !!user)
    console.log('User email:', user?.email)

    return NextResponse.json({
      cookies: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })),
      session: session ? {
        exists: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          metadata: session.user.user_metadata,
        },
        expiresAt: session.expires_at,
      } : {
        exists: false,
      },
      user: user ? {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
      } : null,
      errors: {
        session: sessionError?.message,
        user: userError?.message,
      },
    })
  } catch (error: any) {
    console.error('Debug auth error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
