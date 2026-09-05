import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: createSecurityHeaders({ isProduction: process.env.NODE_ENV === 'production' }) }]
  },
  async redirects() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'www.masabu.co' }],
      destination: 'https://masabu.co/:path*',
      permanent: true,
    }]
  },
  transpilePackages: ['@garsonless/ui', '@garsonless/db', '@garsonless/application', '@garsonless/domain'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  outputFileTracingIncludes: {
    '/blog/[slug]': ['./content/blog/*.mdx'],
  },
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
