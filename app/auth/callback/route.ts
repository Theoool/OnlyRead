import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')

  console.log('=== OAuth Callback Route ===')
  console.log('URL:', requestUrl.href)
  console.log('Code:', code)

  if (!code) {
    console.log('❌ No code in callback')
    return NextResponse.redirect(new URL('/?error=no_code', requestUrl.origin))
  }

  // Create response with proper cookie handling
  const response = NextResponse.redirect(new URL('/', requestUrl.origin))

  const cookieStore = await cookies()

  // Create Supabase client that can set cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log(`🍪 Setting cookie: ${name} (value length: ${value?.length || 0})`)
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          } catch (error) {
            console.error('Error setting cookies:', error)
          }
        },
      },
    }
  )

  // Exchange the OAuth code for a session
  console.log('Exchanging code for session...')
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('❌ Error exchanging code:', error)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message)}`, requestUrl.origin))
  }

  console.log('✅ Session exchanged successfully')
  console.log('User:', data.session?.user?.email)
  console.log('Access token:', data.session?.access_token ? 'exists' : 'missing')
  console.log('Refresh token:', data.session?.refresh_token ? 'exists' : 'missing')

  // Set the session explicitly
  if (data.session) {
    console.log('Setting session cookies...')
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })

    // Check what cookies were set
    const responseCookies = response.cookies.getAll().filter(c => c.name.includes('sb-'))
    console.log('📦 Response cookies:', responseCookies.map(c => `${c.name}=${c.value ? 'set' : 'empty'}`))

    const cookieStoreCookies = cookieStore.getAll().filter(c => c.name.includes('sb-'))
    console.log('📦 CookieStore cookies:', cookieStoreCookies.map(c => `${c.name}=${c.value ? 'set' : 'empty'}`))
  }

  console.log('Redirecting to home with cookies...')
  return response
}
