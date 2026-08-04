import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
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
  experimental: {
    serverActions: {
      // Theme/menu media validates at 2–8 MB inside authenticated actions.
      // Multipart overhead needs a small margin above the largest accepted file.
      bodySizeLimit: '9mb',
    },
  },
}

export default nextConfig
