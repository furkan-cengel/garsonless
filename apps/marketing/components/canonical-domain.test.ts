import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import nextConfig from '../next.config'

test('www marketing requests permanently redirect to the canonical apex origin', async () => {
  assert.ok(nextConfig.redirects)
  assert.deepEqual(await nextConfig.redirects(), [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.masabu.co' }],
      destination: 'https://masabu.co/:path*',
      permanent: true,
    },
  ])
})

test('the marketing homepage publishes the apex canonical link', () => {
  const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
  assert.match(homepage, /alternates:\s*\{ canonical: '\/' \}/)
})
