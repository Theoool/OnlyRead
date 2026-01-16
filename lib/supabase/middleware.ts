import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Debug logging for OAuth callback
  if (request.nextUrl.pathname === '/auth/callback') {
    console.log('=== Middleware OAuth Callback ===')
    console.log('URL:', request.url)
    console.log('Search params:', Object.fromEntries(request.nextUrl.searchParams))

    // CRITICAL: This exchanges the OAuth code for a session
    console.log('Calling getSession() to exchange OAuth code...')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('getSession() - error:', sessionError?.message)
    console.log('getSession() - session exists:', !!sessionData.session)

    if (sessionData.session) {
      console.log('✅ Session established in middleware')
      console.log('User:', sessionData.session.user.email)
      console.log('Access token:', !!sessionData.session.access_token)
      console.log('Refresh token:', !!sessionData.session.refresh_token)
    } else {
      console.log('⚠️ No session after getSession()')
    }

    const cookiesSet = supabaseResponse.cookies.getAll().filter(c => c.name.includes('sb-'))
    console.log('Cookies set by middleware:', cookiesSet.map(c => `${c.name}=${c.value ? 'set' : 'empty'}`))

    // Return the response with cookies set
    return supabaseResponse
  }

  // For non-OAuth routes, just refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/review', '/options']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    // Redirect to home page if not authenticated
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
