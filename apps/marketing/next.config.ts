import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/ui'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
