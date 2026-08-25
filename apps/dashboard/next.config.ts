import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders({ noIndex: true, isProduction: process.env.NODE_ENV === 'production' }) }]
  },
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/domain',
  ],
  serverExternalPackages: ['iyzipay', 'sharp'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
