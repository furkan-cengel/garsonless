import type { NextConfig } from 'next'
import path from 'node:path'
import { createSecurityHeaders } from '../../next-security-headers.mjs'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost', 'sandbox.masabu.co'],
  poweredByHeader: false,
  distDir: process.env['NEXT_DIST_DIR'] || '.next',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: createSecurityHeaders({
          noIndex: true,
          isProduction: process.env.NODE_ENV === 'production',
          additionalFrameOrigins: [process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'],
        }),
      },
      {
        source: '/api/billing/iyzico/card-update/callback',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        // The iyzico callback is rendered only inside the same-origin checkout
        // iframe so it can deliver the provider result to the dashboard. Keep
        // every other dashboard route non-embeddable.
        source: '/api/billing/iyzico/checkout/callback',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
  transpilePackages: [
    '@garsonless/ui',
    '@garsonless/design-engine',
    '@garsonless/db',
    '@garsonless/domain',
  ],
  serverExternalPackages: ['iyzipay', 'sharp'],
  turbopack: {
    root: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
