import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/application', '@garsonless/db', '@garsonless/domain', '@garsonless/ui'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
