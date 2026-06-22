import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/ui', '@garsonless/db'],
  experimental: {},
}

export default nextConfig
