import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CookieOptions, createServerClient } from '@supabase/ssr'

/**
 * Global Middleware for API authentication
 * Runs before all /api/* routes (except public paths)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths that don't require authentication
  const publicPaths = ['/api/auth/', '/api/check-config']

  // Skip middleware for public paths & static assets
  if (publicPaths.some((path) => pathname.startsWith(path)) || pathname.includes('.')) {
    return NextResponse.next()
  }

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(nextCookies: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.push(...nextCookies)
            try {
              nextCookies.forEach(({ name, value }) => request.cookies.set(name, value))
            } catch {}
          },
        },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      const unauth = NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
      cookiesToSet.forEach(({ name, value, options }) => unauth.cookies.set(name, value, options))
      return unauth
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-email', user.email || '')

    const next = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    cookiesToSet.forEach(({ name, value, options }) => next.cookies.set(name, value, options))
    return next
  } catch {
    const response = NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    )
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }
}

// Apply middleware to all API routes
// Note: matcher syntax is limited
export const config = {
  matcher: '/api/:path*',
}
