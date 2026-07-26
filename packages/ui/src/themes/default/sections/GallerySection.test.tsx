import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GallerySection, resolveGalleryTiles } from './GallerySection'

test('public gallery stays honest when the restaurant has no photos', () => {
  assert.deepEqual(resolveGalleryTiles({}), [])
  assert.equal(renderToStaticMarkup(<GallerySection config={{}} />), '')
})

test('catalog preview uses safe mock tiles without leaking them into stored content', () => {
  const tiles = resolveGalleryTiles({ catalogMock: 'true', maxItems: '3' })
  assert.equal(tiles.length, 3)
  assert.ok(tiles.every((tile) => tile.imageUrl === '' && tile.mockGradient))
})

test('gallery respects persisted order and the visible photo limit', () => {
  const tiles = resolveGalleryTiles({
    tileOrder: 'tile3,tile1,tile2',
    maxItems: '2',
    tile1Image: 'https://images.example/one.webp',
    tile2Image: 'https://images.example/two.webp',
    tile3Image: 'https://images.example/three.webp',
    tile3Label: 'Mutfaktan',
  })

  assert.deepEqual(tiles.map((tile) => tile.id), ['tile3', 'tile1'])
  assert.equal(tiles[0]?.label, 'Mutfaktan')
})

test('gallery renders uploaded photos and hardens optional external links', () => {
  const html = renderToStaticMarkup(<GallerySection config={{
    tile1Image: 'https://images.example/interior.webp',
    tile1Label: 'İç mekân',
    targetType: 'link',
    targetUrl: 'https://instagram.com/example',
    layout: 'grid',
    columns: '3',
  }} />)

  assert.match(html, /src="https:\/\/images\.example\/interior\.webp"/)
  assert.match(html, /alt="İç mekân"/)
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)

  const unsafe = renderToStaticMarkup(<GallerySection config={{
    tile1Image: 'https://images.example/interior.webp',
    targetType: 'link',
    targetUrl: 'javascript:alert(1)',
  }} />)
  assert.doesNotMatch(unsafe, /javascript:/)
})
