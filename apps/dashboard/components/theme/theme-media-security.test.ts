import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import {
  parseOwnedThemeMediaPath,
  themeDocumentContainsMediaUrl,
  validateThemeMediaMetadata,
} from '../../lib/theme-media-policy'
import { processThemeMedia } from '../../lib/theme-media-processor'

const directory = fileURLToPath(new URL('.', import.meta.url))
const settingsSource = readFileSync(`${directory}/ThemeSectionSettings.tsx`, 'utf8')
const actionSource = readFileSync(`${directory}/../../lib/actions/theme.ts`, 'utf8')
const migrationSource = readFileSync(
  `${directory}/../../../../packages/db/supabase/migrations/20260801040000_storage_asset_tenant_boundaries.sql`,
  'utf8',
)

test('theme media metadata rejects SVG, empty files and purpose-specific oversize input', () => {
  assert.equal(validateThemeMediaMetadata({ size: 1_024, type: 'image/svg+xml', purpose: 'section-icon' }).ok, false)
  assert.equal(validateThemeMediaMetadata({ size: 0, type: 'image/png', purpose: 'section-image' }).ok, false)
  assert.equal(validateThemeMediaMetadata({ size: 2 * 1024 * 1024 + 1, type: 'image/png', purpose: 'section-icon' }).ok, false)
  assert.equal(validateThemeMediaMetadata({ size: 8 * 1024 * 1024, type: 'image/webp', purpose: 'gallery-image' }).ok, true)
  assert.equal(validateThemeMediaMetadata({ size: 2 * 1024 * 1024 + 1, type: 'image/png', purpose: 'auth-header-logo' }).ok, false)
  assert.equal(validateThemeMediaMetadata({ size: 8 * 1024 * 1024, type: 'image/jpeg', purpose: 'auth-header-background' }).ok, true)
})

test('theme media decoder rejects MIME spoofing and emits bounded metadata-free WebP', async () => {
  const png = await sharp({
    create: { width: 1_200, height: 800, channels: 4, background: '#ee8844' },
  }).png().withExif({ IFD0: { Artist: 'must-not-survive' } }).toBuffer()

  const spoofed = await processThemeMedia({ bytes: png, claimedType: 'image/jpeg', purpose: 'section-image' })
  assert.equal(spoofed.ok, false)

  const processed = await processThemeMedia({ bytes: png, claimedType: 'image/png', purpose: 'section-icon' })
  assert.equal(processed.ok, true)
  if (!processed.ok) return
  assert.equal(processed.media.mime, 'image/webp')
  assert.ok(processed.media.width <= 512)
  assert.ok(processed.media.height <= 512)
  const metadata = await sharp(processed.media.bytes).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.exif, undefined)
})

test('cleanup accepts only server-owned media paths for the same restaurant', () => {
  const restaurantId = '11111111-1111-4111-8111-111111111111'
  const assetId = '22222222-2222-4222-8222-222222222222'
  const storageOrigin = 'https://assets.example'
  const valid = `${storageOrigin}/storage/v1/object/public/restaurant-assets/restaurants/${restaurantId}/theme/section-image/${assetId}.webp`
  assert.equal(
    parseOwnedThemeMediaPath({ publicUrl: valid, restaurantId, storageOrigin }),
    `restaurants/${restaurantId}/theme/section-image/${assetId}.webp`,
  )
  assert.equal(parseOwnedThemeMediaPath({ publicUrl: valid, restaurantId: '33333333-3333-4333-8333-333333333333', storageOrigin }), null)
  assert.equal(parseOwnedThemeMediaPath({ publicUrl: 'javascript:alert(1)', restaurantId, storageOrigin }), null)
  assert.equal(parseOwnedThemeMediaPath({ publicUrl: `${valid}/../escape.webp`, restaurantId, storageOrigin }), null)
  assert.equal(parseOwnedThemeMediaPath({ publicUrl: valid.replace(storageOrigin, 'https://evil.example'), restaurantId, storageOrigin }), null)
  const authHeaderLogo = `${storageOrigin}/storage/v1/object/public/restaurant-assets/restaurants/${restaurantId}/theme/auth-header-logo/${assetId}.webp`
  assert.equal(
    parseOwnedThemeMediaPath({ publicUrl: authHeaderLogo, restaurantId, storageOrigin }),
    `restaurants/${restaurantId}/theme/auth-header-logo/${assetId}.webp`,
  )
})

test('live theme reference detection uses exact nested string equality', () => {
  const url = 'https://assets.example/theme/image.webp'
  assert.equal(themeDocumentContainsMediaUrl({ sections: [{ settings: { imageUrl: url } }] }, url), true)
  assert.equal(themeDocumentContainsMediaUrl({ imageUrl: `${url}?other=true` }, url), false)
})

test('Tema UI has no direct storage client and server owns decoding and path generation', () => {
  assert.doesNotMatch(settingsSource, /createDashboardBrowserClient|storage\.from|image\/svg\+xml/)
  assert.match(settingsSource, /uploadThemeMedia/)
  assert.match(settingsSource, /removeUnusedThemeMedia/)
  assert.match(actionSource, /assertAccess\(restaurantId, 'theme'\)/)
  assert.match(actionSource, /processThemeMedia/)
  assert.match(actionSource, /themeMediaStoragePrefix\(restaurantId\)/)
  assert.match(actionSource, /themeDocumentContainsMediaUrl/)
  assert.match(actionSource, /createRestaurantAssetStoragePort/)
  assert.doesNotMatch(actionSource, /supabase\.storage/)
})

test('storage migration removes every direct authenticated mutation policy', () => {
  assert.match(migrationSource, /drop policy if exists storage_authenticated_write/)
  assert.match(migrationSource, /drop policy if exists storage_authenticated_update/)
  assert.match(migrationSource, /drop policy if exists storage_authenticated_delete/)
  assert.doesNotMatch(migrationSource, /create policy/i)
})
