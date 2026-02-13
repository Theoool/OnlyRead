import { createServerClient, } from '@supabase/ssr'

import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 创建响应对象
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet:any) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // ⚠️ 关键优化：只在 Middleware 调用一次 getUser()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError) {
    console.error('Auth error in middleware:', userError.message)
  }

  // 🚀 核心优化：将用户信息注入请求头，供 API 路由使用
  if (user) {
    request.headers.set('x-user-id', user.id)
    request.headers.set('x-user-email', user.email || '')
    request.headers.set('x-user-authenticated', 'true')
  } else {
    request.headers.set('x-user-authenticated', 'false')
  }

  // 更新响应以包含修改后的请求头
  supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // OAuth Callback 特殊处理（保持原有逻辑）
  if
  
  
  (request.nextUrl.pathname === '/auth/callback') {
    console.log('=== Middleware OAuth Callback ===')
    const { data: sessionData } = await supabase.auth.getSession()
    
    if (sessionData.session) {
      console.log('✅ OAuth Session established')
      // 同样注入 header
      request.headers.set('x-user-id', sessionData.session.user.id)
    }
    return supabaseResponse
  }

  // Protected routes 逻辑（保持不变）
  const protectedPaths = ['/review', '/options']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

  