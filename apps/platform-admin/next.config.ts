import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders({ noIndex: true, isProduction: process.env.NODE_ENV === 'production' }) }]
  },
  transpilePackages: ['@garsonless/application', '@garsonless/db', '@garsonless/domain', '@garsonless/ui'],
  // iyzipay 2.x resolves resource modules dynamically at runtime. Keeping the
  // Node-only SDK external prevents Turbopack from trying to statically bundle
  // those CommonJS resource lookups into the admin application.
  serverExternalPackages: ['iyzipay'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
