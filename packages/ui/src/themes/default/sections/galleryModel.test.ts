import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveGallery, resolveGalleryOrder } from './galleryModel'

test('gallery resolver sanitizes order, limits and numeric layout values', () => {
  const gallery = resolveGallery({
    editorialVersion: '2',
    tileOrder: 'tile3,tile3,missing,tile1',
    maxItems: '99',
    rowHeight: '999',
    gap: '-2',
    padding: '500',
    radius: '-8',
    columns: '9',
    layout: 'unknown',
    imagePosition: 'left',
    tile1Image: 'one', tile2Image: 'two', tile3Image: 'three',
  })
  assert.deepEqual(resolveGalleryOrder('tile3,tile3,missing,tile1'), ['tile3', 'tile1', 'tile2', 'tile4', 'tile5', 'tile6'])
  assert.deepEqual(gallery.tiles.map((tile) => tile.id), ['tile3', 'tile1', 'tile2'])
  assert.equal(gallery.maxItems, 6)
  assert.equal(gallery.rowHeight, 180)
  assert.equal(gallery.gap, 4)
  assert.equal(gallery.padding, 28)
  assert.equal(gallery.radius, 0)
  assert.equal(gallery.columns, 2)
  assert.equal(gallery.layout, 'mosaic')
  assert.equal(gallery.mosaicPattern, 'editorial')
  assert.equal(gallery.imagePosition, 'center')
})

test('gallery resolver accepts supported mosaic patterns and rejects unknown values', () => {
  assert.equal(resolveGallery({ mosaicPattern: 'spotlight' }).mosaicPattern, 'spotlight')
  assert.equal(resolveGallery({ mosaicPattern: 'collage' }).mosaicPattern, 'collage')
  assert.equal(resolveGallery({ mosaicPattern: 'unknown' }).mosaicPattern, 'editorial')
})

test('gallery resolver covers zero through six photos and visible limits', () => {
  for (let count = 0; count <= 6; count += 1) {
    const config = Object.fromEntries(Array.from({ length: count }, (_, index) => [`tile${index + 1}Image`, `image-${index + 1}`]))
    for (let limit = 1; limit <= 6; limit += 1) {
      assert.equal(resolveGallery({ ...config, maxItems: String(limit) }).tiles.length, Math.min(count, limit))
    }
  }
})

test('only catalog mode synthesizes non-persisted placeholder tiles', () => {
  assert.equal(resolveGallery({}, 'public').tiles.length, 0)
  assert.equal(resolveGallery({}, 'editor').tiles.length, 0)
  assert.equal(resolveGallery({ maxItems: '4' }, 'catalog').tiles.length, 4)
})
