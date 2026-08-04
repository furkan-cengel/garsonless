import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/domain',
    '@garsonless/ai',
  ],
  serverExternalPackages: ['iyzipay'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
