import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['@garsonless/ui'],
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  outputFileTracingIncludes: {
    '/blog/[slug]': ['./content/blog/*.mdx'],
  },
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
