import assert from 'node:assert/strict'
import test from 'node:test'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { resolveHomeOpenGraphImage } from './home-metadata.ts'

test('first enabled modern Video Hero poster wins over legacy metadata media', () => {
  const theme = {
    surfaces: { home: {
      blocks: [
        { id: 'disabled', sectionId: 'storefront-video-hero', enabled: false },
        { id: 'video', sectionId: 'storefront-video-hero', enabled: true },
      ],
      sections: [{ id: 'legacy', type: 'hero-video', enabled: true, posterUrl: 'legacy.webp' }],
    } },
    sectionSettings: { disabled: { posterUrl: 'disabled.webp' }, video: { posterUrl: 'modern.webp' } },
  } as unknown as GarsonlessTheme
  assert.equal(resolveHomeOpenGraphImage(theme), 'modern.webp')
})

test('metadata falls back to legacy media and safely handles an empty home', () => {
  const legacy = { surfaces: { home: { blocks: [], sections: [{ id: 'legacy', type: 'hero-video', enabled: true, imageUrl: 'legacy.webp' }] } } } as unknown as GarsonlessTheme
  assert.equal(resolveHomeOpenGraphImage(legacy), 'legacy.webp')
  assert.equal(resolveHomeOpenGraphImage(null), null)
})
