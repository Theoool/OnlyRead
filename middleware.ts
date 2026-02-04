import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Global Middleware for API authentication
 * Runs before all /api/* routes (except public paths)
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Public paths that don't require authentication
    const publicPaths = [
        '/api/auth/',
        '/api/check-config',
        // Add other public paths if needed
    ]

    // Skip middleware for public paths & static assets
    if (
        publicPaths.some(path => pathname.startsWith(path)) ||
        pathname.includes('.') // skip files
    ) {
        return NextResponse.next()
    }

    try {
        // Get session from Supabase
        const supabase = await createClient()
        // Use getUser() instead of getSession() for security and to avoid warnings
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED' },
                { status: 401 }
            )
        }

        // Inject user info into headers for downstream routes
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', user.id)
        requestHeaders.set('x-user-email', user.email || '')

        // Continue with modified headers
        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        })
    } catch (error) {
        console.error('Middleware error:', error)
        return NextResponse.json(
            { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' },
            { status: 500 }
        )
    }
}

// Apply middleware to all API routes
// Note: matcher syntax is limited
export const config = {
    matcher: '/api/:path*',
}
