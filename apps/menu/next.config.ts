import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  distDir: process.env['NEXT_DIST_DIR'] || '.next',
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
    return [
      { source: '/:path*', headers: createSecurityHeaders({ allowEmbedding: true, isProduction: process.env.NODE_ENV === 'production' }) },
      // iOS Quick Look only opens USDZ served with its registered media type.
      { source: '/ar-spike/:file*.usdz', headers: [{ key: 'Content-Type', value: 'model/vnd.usdz+zip' }] },
      { source: '/ar-spike/:file*.glb', headers: [{ key: 'Content-Type', value: 'model/gltf-binary' }] },
    ]
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
