import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsdom', '@napi-rs/canvas', 'pdfjs-dist', 'canvas'],
  // Enable standalone output for Docker
  output: 'standalone',

  // Experimental config for large uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Optimize for production
  reactStrictMode: true,
  // swcMinify is now default in Next.js 16, no need to specify

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  async redirects() {
    return [
      {
        source: '/stats/search',
        destination: '/search',
        permanent: true,
      },
      {
        source: '/stats',
        destination: '/',
        permanent: true,
      },
      {
        source: '/review',
        destination: '/',
        permanent: true,
      },
      {
        source: '/options',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ];
  },
};

export default bundleAnalyzer(nextConfig);
