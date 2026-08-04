import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/domain',
  ],
  serverExternalPackages: ['iyzipay', 'sharp'],
  experimental: {
    serverActions: {
      // Theme/menu media validates at 2–8 MB inside authenticated actions.
      // Multipart overhead needs a small margin above the largest accepted file.
      bodySizeLimit: '9mb',
    },
  },
}

export default nextConfig
