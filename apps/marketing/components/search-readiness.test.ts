import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sitemap from '../app/sitemap'
import { marketingMetadata, organizationGraph, serializeJsonLd } from '../lib/seo'
import { BLOG_POSTS } from '../lib/blog'
import { PRODUCT_PAGES } from '../lib/product-pages'

test('sitemap contains only canonical content routes and every new landing page', () => {
  const entries = sitemap()
  const urls = entries.map((entry) => entry.url)
  assert.equal(new Set(urls).size, urls.length)
  for (const legacy of ['solutions', 'resources', 'company', 'legal']) assert.ok(!urls.includes(`https://masabu.co/${legacy}`))
  for (const product of PRODUCT_PAGES) {
    assert.ok(urls.includes(`https://masabu.co/${product.slug}`))
    assert.ok(existsSync(path.join(process.cwd(), 'app', product.slug, 'page.tsx')))
    assert.ok(existsSync(path.join(process.cwd(), 'public', product.image)))
    assert.ok(BLOG_POSTS.some((post) => post.slug === product.guide))
  }
  assert.ok(entries.every((entry) => !entry.priority && !entry.changeFrequency))
})

test('page-specific social metadata preserves images, title and canonical URL', () => {
  for (const canonical of ['/fiyatlar', '/blog/example']) {
    const metadata = marketingMetadata({ title: 'Sayfa', description: 'Açıklama', canonical })
    assert.equal(metadata.alternates?.canonical, canonical)
    assert.equal(metadata.openGraph?.url, `https://masabu.co${canonical}`)
    assert.deepEqual(metadata.openGraph?.images, metadata.twitter?.images)
    assert.ok(metadata.openGraph?.images)
  }
})

test('brand graph connects publisher and website without fabricated profiles or ratings', () => {
  const graph = organizationGraph()
  assert.equal(graph['@graph'][1]?.publisher?.['@id'], graph['@graph'][0]?.['@id'])
  assert.ok(!serializeJsonLd(graph).includes('aggregateRating'))
  const organization = graph['@graph'][0]
  assert.ok(organization && 'sameAs' in organization)
  assert.deepEqual(organization.sameAs, [
    'https://www.instagram.com/masabuco/',
    'https://www.facebook.com/profile.php?id=61593248557981',
    'https://www.linkedin.com/company/masabu/',
  ])
  assert.ok(!serializeJsonLd({ title: '</script><script>alert(1)</script>' }).includes('<'))
})
