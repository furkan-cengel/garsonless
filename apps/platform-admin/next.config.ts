import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/application', '@garsonless/db', '@garsonless/domain', '@garsonless/ui'],
}

export default nextConfig
