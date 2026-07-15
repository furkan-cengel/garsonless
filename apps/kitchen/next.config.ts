import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/ui', '@garsonless/db', '@garsonless/domain'],
  experimental: {},
}

export default nextConfig
