import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  images: {
    remotePatterns: ['yxsegwkzyiscrxiwdeuf.supabase.co', 'svxvloeosiksqfadgkvo.supabase.co'].map(hostname => ({
      protocol: 'https' as const,
      hostname,
      pathname: '/storage/v1/object/public/restaurant-assets/**',
      search: '',
    })),
  },
  async headers() {
    // Tenant-aware frame-ancestors is applied by menu middleware.
    return [{ source: '/:path*', headers: createSecurityHeaders({ allowEmbedding: true, isProduction: process.env.NODE_ENV === 'production' }) }]
  },
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/domain',
  ],
  serverExternalPackages: ['iyzipay'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
