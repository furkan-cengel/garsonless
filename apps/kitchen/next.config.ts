import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/ui', '@garsonless/db', '@garsonless/domain'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
  experimental: {},
}

export default nextConfig
