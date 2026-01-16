import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(req: Request) {
  const requestUrl = new URL(req.url)

  console.log('=== GitHub OAuth Initiated ===')
  console.log('Origin:', requestUrl.origin)

  const supabase = await createClient()

  // Get the current URL for the callback
  const origin = requestUrl.origin
  const redirectTo = `${origin}/auth/callback`

  console.log('Redirect to after auth:', redirectTo)

  // Sign in with GitHub using Supabase Auth
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo,
      // Request access to user email and profile
      scopes: 'read:user user:email',
    },
  })

  if (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(error.message)}`
    )
  }

  console.log('✅ GitHub OAuth URL generated:', data.url)

  // Redirect to the GitHub authorization page
  return redirect(data.url)
}
