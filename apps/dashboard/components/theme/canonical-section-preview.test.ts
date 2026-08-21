import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogSectionPreviewConfig } from './CanonicalSectionPreview'

test('Hero katalog önizlemeleri restoran içeriğini generic ve kaydedilmeyen örneklerle değiştirir', () => {
  const stored = {
    title: 'MAF Cafe Lounge',
    body: 'Restorana özel açıklama',
    imageUrl: 'https://cdn.example.com/hero.webp',
    videoUrl: 'https://cdn.example.com/hero.webm',
    posterUrl: 'https://cdn.example.com/poster.webp',
  }

  const banner = buildCatalogSectionPreviewConfig('hero-banner', stored)
  const video = buildCatalogSectionPreviewConfig('storefront-video-hero', stored)

  assert.equal(banner.title, 'Lezzetleri keşfedin')
  assert.equal(banner.imageUrl, '')
  assert.equal(banner.targetUrl, 'https://example.invalid')
  assert.equal(video.title, 'Mekânın hikâyesi')
  assert.equal(video.videoUrl, '')
  assert.equal(video.posterUrl, '')
  assert.doesNotMatch(JSON.stringify({ banner, video }), /MAF Cafe Lounge|Restorana özel açıklama/)
  assert.equal(stored.title, 'MAF Cafe Lounge')
  assert.equal(stored.imageUrl, 'https://cdn.example.com/hero.webp')
})

test('generic katalog içeriği Hero dışındaki bölüm ayarlarını değiştirmez', () => {
  const config = { title: 'Mekândan Kareler' }
  assert.equal(buildCatalogSectionPreviewConfig('gallery', config), config)
})
