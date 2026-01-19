import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/lib/infrastructure/database/prisma'

export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  console.log('=== Auth Callback Route ===')
  console.log('URL:', requestUrl.href)
  console.log('Code:', code)

  if (!code) {
    console.log('❌ No code in callback')
    return NextResponse.redirect(new URL('/?error=no_code', requestUrl.origin))
  }

  const cookieStore = await cookies()

  // Create Supabase client that can set cookies on the response
  // We need to create a response object first to handle cookies properly
  // However, since we might redirect to different places, we'll handle the redirect at the end
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
              cookieStore.set(name, value, options)
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
  
  if (data.session?.user) {
    const user = data.session.user
    console.log('User:', user.email)
    
    try {
      // Sync user with Prisma
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      })

      if (!dbUser) {
        console.log('Creating new user in Prisma...')
        await prisma.user.create({
          data: {
            id: user.id,
            email: user.email!,
            fullName: user.user_metadata?.full_name || user.user_metadata?.name,
            avatarUrl: user.user_metadata?.avatar_url,
          },
        })
      } else {
        console.log('Updating existing user in Prisma...')
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastActiveAt: new Date(),
            // Update metadata if changed (optional, but good for keeping sync)
            fullName: user.user_metadata?.full_name || user.user_metadata?.name || dbUser.fullName,
            avatarUrl: user.user_metadata?.avatar_url || dbUser.avatarUrl,
          },
        })
      }
    } catch (dbError) {
      console.error('Failed to sync user with database:', dbError)
      // We don't block the login flow if DB sync fails, but we log it
    }
  }

  // Create the final response with the redirect
  const response = NextResponse.redirect(new URL(next, requestUrl.origin))
  
  // Copy cookies from our store (which has the new session cookies) to the response
  // This is crucial because createServerClient updated the cookieStore, but we need to pass those to the browser
  const newCookies = cookieStore.getAll()
  newCookies.forEach(cookie => {
    response.cookies.set(cookie.name, cookie.value, cookie)
  })

  console.log('Redirecting to:', next)
  return response
}
