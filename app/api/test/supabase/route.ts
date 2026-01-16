import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    console.log('=== Supabase Configuration Test ===')

    // Test 1: Environment variables
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30) + '...',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing',
    }
    console.log('Environment variables:', env)

    // Test 2: Create client
    const supabase = await createClient()
    console.log('✅ Supabase client created')

    // Test 3: Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Session check:', { hasSession: !!session, error: sessionError?.message })

    // Test 4: Get URL
    const { data: { url }, error: urlError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })
    console.log('OAuth URL generated:', !!url, urlError?.message)

    return NextResponse.json({
      success: true,
      environment: env,
      session: session ? {
        exists: true,
        user: {
          id: session.user.id,
          email: session.user.email,
        },
      } : {
        exists: false,
        error: sessionError?.message,
      },
      oauthUrl: url ? 'Generated successfully' : urlError?.message,
    })
  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
