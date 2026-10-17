import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuArVersion } from '@garsonless/application/menu-ar'
import { formatCm, isMenuArFormDirty, menuArDraftSizes, menuArFormFromVersion, menuArPosterUrl, menuArStatus, parseCm } from './menu-item-ar-model'

const version: MenuArVersion = {
  id: 'v1', glbAssetId: 'g1', usdzAssetId: null, glbUrl: 'https://x/model.glb', usdzUrl: null, posterUrl: null,
  widthMm: 260, depthMm: 260, heightMm: 45, portionNote: '2 kişilik', publishedAt: null,
}

test('status follows the draft and the published pointer', () => {
  assert.equal(menuArStatus({ draft: null, publishedVersionId: null }), 'none')
  assert.equal(menuArStatus({ draft: version, publishedVersionId: null }), 'draft')
  assert.equal(menuArStatus({ draft: version, publishedVersionId: 'v1' }), 'live')
  assert.equal(menuArStatus({ draft: version, publishedVersionId: 'v0' }), 'live-changed')
})

test('sizes are typed in centimetres and stored in millimetres', () => {
  assert.deepEqual(parseCm('12,5'), { ok: true, mm: 125 })
  assert.deepEqual(parseCm(' '), { ok: true, mm: null })
  assert.deepEqual(parseCm('12 cm'), { ok: false })
  assert.equal(formatCm(125), '12,5')
  assert.equal(formatCm(260), '26')
  const form = { ...menuArFormFromVersion(version), height: '0,3' }
  assert.deepEqual(menuArDraftSizes(form), { ok: false, field: 'height', error: '0,5–100 cm arasında bir sayı girin.' })
  assert.deepEqual(menuArDraftSizes({ ...form, height: '4,5' }), { ok: true, widthMm: 260, depthMm: 260, heightMm: 45 })
})

test('a loaded version is clean until a field changes', () => {
  const form = menuArFormFromVersion(version)
  assert.equal(isMenuArFormDirty(form, version), false)
  assert.equal(isMenuArFormDirty({ ...form, portionNote: '3 kişilik' }, version), true)
  assert.equal(isMenuArFormDirty({ ...form, usdzAssetId: 'u1' }, version), true)
})

test('only the restaurant\'s own public images become the poster', () => {
  const own = 'https://p.supabase.co/storage/v1/object/public/restaurant-assets/restaurants/r1/library/a/menu.webp'
  assert.equal(menuArPosterUrl(own, 'r1'), own)
  assert.equal(menuArPosterUrl(own, 'r2'), null)
  assert.equal(menuArPosterUrl('https://cdn.example.com/a.jpg', 'r1'), null)
  assert.equal(menuArPosterUrl(null, 'r1'), null)
})
