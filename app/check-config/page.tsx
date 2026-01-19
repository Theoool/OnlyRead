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
    return <div className="p-8">加载中...</div>;
  }

  if (!data) {
    return <div className="p-8">加载配置失败</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">{data.title}</h1>

        {/* Environment Check */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">环境变量</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={data.checks.env.supabaseUrl ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.supabaseUrl ? '✅' : '❌'}
              </span>
              <span>NEXT_PUBLIC_SUPABASE_URL: {data.checks.env.supabaseUrl ? '已设置' : '缺失'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={data.checks.env.supabaseAnonKey ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.supabaseAnonKey ? '✅' : '❌'}
              </span>
              <span>NEXT_PUBLIC_SUPABASE_ANON_KEY: {data.checks.env.supabaseAnonKey ? '已设置' : '缺失'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={data.checks.env.serviceRoleKey ? 'text-green-500' : 'text-red-500'}>
                {data.checks.env.serviceRoleKey ? '✅' : '❌'}
              </span>
              <span>SUPABASE_SERVICE_ROLE_KEY: {data.checks.env.serviceRoleKey ? '已设置' : '缺失'}</span>
            </div>
          </div>
        </div>

        {/* GitHub OAuth App Config */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 bg-yellow-50 dark:bg-yellow-900/20">
          <h2 className="text-xl font-bold mb-4">🔑 GitHub OAuth 应用配置</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">1. 访问：</p>
              <a href={data.checks.github.oauthAppUrl} target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline">
                {data.checks.github.oauthAppUrl}
              </a>
            </div>
            <div>
              <p className="font-semibold">2. 找到您的 OAuth 应用 (Anti-AI Reader)</p>
            </div>
            <div>
              <p className="font-semibold">3. 将授权回调 URL 设置为：</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2 text-red-600 font-bold">
                {data.correctConfig.github.authorizationCallbackUrl}
              </code>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                ⚠️ <strong>重要：</strong> 这必须是 Supabase URL，而不是您的应用 URL！
              </p>
            </div>
            <div>
              <p className="font-semibold">4. 主页 URL 应为：</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.github.homepageUrl}
              </code>
            </div>
          </div>
        </div>

        {/* Supabase Config */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
          <h2 className="text-xl font-bold mb-4">⚙️ Supabase 提供商配置</h2>
          <div className="space-y-4">
            <div>
              <p className="font-semibold">1. 访问：</p>
              <a href={data.checks.supabase.dashboardUrl} target="_blank" rel="noopener noreferrer"
                 className="text-blue-500 underline">
                {data.checks.supabase.dashboardUrl}/auth/providers
              </a>
            </div>
            <div>
              <p className="font-semibold">2. 启用 GitHub 提供商</p>
            </div>
            <div>
              <p className="font-semibold">3. 填写 GitHub OAuth 凭据</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                （来自 GitHub OAuth 应用的客户端 ID 和密钥）
              </p>
            </div>
            <div>
              <p className="font-semibold">4. 添加到重定向 URL：</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.supabase.redirectUrls[0]}
              </code>
            </div>
            <div>
              <p className="font-semibold">5. 将站点 URL 设置为：</p>
              <code className="block bg-zinc-100 dark:bg-zinc-900 p-3 rounded mt-2">
                {data.correctConfig.supabase.siteUrl}
              </code>
            </div>
            <div>
              <p className="font-semibold">6. 点击保存并等待 10-20 秒</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔗 快速链接</h2>
          <div className="space-y-2">
            <a href={data.checks.supabase.dashboardUrl + '/auth/providers'} target="_blank" rel="noopener noreferrer"
               className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              打开 Supabase 提供商设置 →
            </a>
            <a href={data.checks.github.oauthAppUrl} target="_blank" rel="noopener noreferrer"
               className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              打开 GitHub OAuth 应用 →
            </a>
            <a href="/" className="block p-3 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
              返回首页 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
