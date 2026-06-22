import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/qr',
  ],
  serverExternalPackages: ['sharp', 'iyzipay'],
}

export default nextConfig
