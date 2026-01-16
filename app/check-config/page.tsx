"use client";

import { useEffect, useState } from "react";

interface ConfigData {
  title: string;
  checks: any;
  instructions: any;
  correctConfig: any;
}

export default function CheckConfigPage() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/check-config')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!data) {
    return <div className="p-8">Failed to load configuration</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">{data.title}</h1>

        {/* Environment Check */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={data.checks.env.supabaseUrl ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.supabaseUrl ? '✅' : '❌'}
              </span>
              <span>NEXT_PUBLIC_SUPABASE_URL: {data.checks.env.supabaseUrl ? 'Set' : 'Missing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={data.checks.env.supabaseAnonKey ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.supabaseAnonKey ? '✅' : '❌'}
              </span>
              <span>NEXT_PUBLIC_SUPABASE_ANON_KEY: {data.checks.env.supabaseAnonKey ? 'Set' : 'Missing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={data.checks.env.serviceRoleKey ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.serviceRoleKey ? '✅' : '❌'}
              </span>
              <span>SUPABASE_SERVICE_ROLE_KEY: {data.checks.env.serviceRoleKey ? 'Set' : 'Missing'}</span>
            </div>
          </div>
        </div>

        {/* GitHub OAuth App Config */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 bg-yellow-50 dark:bg-yellow-900/20">
          <h2 className="text-xl font-bold mb-4">🔑 GitHub OAuth App Configuration</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">1. Visit:</p>
              <a href={data.checks.github.oauthAppUrl} target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline">
                {data.checks.github.oauthAppUrl}
              </a>
            </div>
            <div>
              <p className="font-semibold">2. Find your OAuth App (Anti-AI Reader)</p>
            </div>
            <div>
              <p className="font-semibold">3. Set Authorization callback URL to:</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2 text-red-600 font-bold">
                {data.correctConfig.github.authorizationCallbackUrl}
              </code>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                ⚠️ <strong>Important:</strong> This must be the Supabase URL, NOT your app URL!
              </p>
            </div>
            <div>
              <p className="font-semibold">4. Homepage URL should be:</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.github.homepageUrl}
              </code>
            </div>
          </div>
        </div>

        {/* Supabase Config */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
          <h2 className="text-xl font-bold mb-4">⚙️ Supabase Provider Configuration</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">1. Visit:</p>
              <a href={data.checks.supabase.dashboardUrl} target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline">
                {data.checks.supabase.dashboardUrl}/auth/providers
              </a>
            </div>
            <div>
              <p className="font-semibold">2. Enable GitHub Provider</p>
            </div>
            <div>
              <p className="font-semibold">3. Fill in GitHub OAuth credentials</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                (Client ID and Secret from GitHub OAuth App)
              </p>
            </div>
            <div>
              <p className="font-semibold">4. Add to Redirect URLs:</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.supabase.redirectUrls[0]}
              </code>
            </div>
            <div>
              <p className="font-semibold">5. Set Site URL to:</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.supabase.siteUrl}
              </code>
            </div>
            <div>
              <p className="font-semibold">6. Click Save and wait 10-20 seconds</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔗 Quick Links</h2>
          <div className="space-y-2">
            <a href={data.checks.supabase.dashboardUrl + '/auth/providers'} target="_blank" rel="noopener noreferrer"
               className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              Open Supabase Provider Settings →
            </a>
            <a href={data.checks.github.oauthAppUrl} target="_blank" rel="noopener noreferrer"
               className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              Open GitHub OAuth Apps →
            </a>
            <a href="/" className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              Back to Home →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
