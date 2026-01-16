import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const checks: any = {
    env: {},
    supabase: {},
    github: {},
  }

  // Check environment variables
  checks.env.supabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  checks.env.supabaseAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  checks.env.serviceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  // Parse project ref from URL
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([\w-]+)\.supabase\.co/)?.[1]

  if (projectRef) {
    checks.supabase.projectRef = projectRef
    checks.supabase.callbackUrl = `https://${projectRef}.supabase.co/auth/v1/callback`
    checks.supabase.dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}`
  }

  // Generate correct GitHub OAuth App config
  checks.github.oauthAppUrl = 'https://github.com/settings/developers'
  checks.github.requiredCallbackUrl = checks.supabase.callbackUrl
  checks.github.allowedHomepageUrl = 'http://localhost:3000'

  return NextResponse.json({
    title: 'Supabase OAuth Configuration Check',
    checks,
    instructions: {
      step1: '1. GitHub OAuth App Configuration',
      step2: '2. Supabase Provider Configuration',
      step3: '3. Test Login Flow',
    },
    correctConfig: {
      github: {
        applicationName: 'Anti-AI Reader',
        homepageUrl: 'http://localhost:3000',
        authorizationCallbackUrl: checks.supabase.callbackUrl || 'MISSING',
      },
      supabase: {
        providerEnabled: true,
        redirectUrls: ['http://localhost:3000/auth/callback'],
        siteUrl: 'http://localhost:3000',
      },
    },
  })
}
