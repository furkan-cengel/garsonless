import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GallerySection, resolveGalleryTiles } from './GallerySection'
import { CustomSectionRenderer } from './CustomSectionRenderer'

test('public gallery stays honest when the restaurant has no photos', () => {
  assert.deepEqual(resolveGalleryTiles({}), [])
  assert.equal(renderToStaticMarkup(<GallerySection config={{}} />), '')
})

test('catalog preview uses explicit preview mode without leaking mocks into stored content', () => {
  const tiles = resolveGalleryTiles({ maxItems: '3' }, 'catalog')
  assert.equal(tiles.length, 3)
  assert.ok(tiles.every((tile) => tile.imageUrl === '' && tile.mockGradient))
})

test('home section catalog explicitly renders the gallery mock instead of an empty preview', () => {
  const html = renderToStaticMarkup(<CustomSectionRenderer
    sectionId="gallery"
    restaurantName="Örnek Mekân"
    renderContext="home"
    editorPreview
    catalogPreview
  />)
  assert.match(html, /data-gallery-version="2"/)
  assert.match(html, /data-count="5"/)
  assert.match(html, /Mekândan Kareler/)
})

test('modern gallery exposes semantic heading and balanced count hooks', () => {
  const html = renderToStaticMarkup(<GallerySection previewMode="public" config={{
    editorialVersion: '2',
    tile1Image: 'https://images.example/one.webp',
    tile2Image: 'https://images.example/two.webp',
    title: 'Çok Uzun Türkçe Galeri Başlığı',
  }} />)
  assert.match(html, /<h2/)
  assert.match(html, /data-gallery-version="2"/)
  assert.match(html, /data-count="2"/)
  assert.match(html, /min-height:44px/)
  assert.match(html, /grid-template-columns:minmax\(0,1fr\) auto/)
  assert.match(html, /justify-self:end/)
  assert.doesNotMatch(html, /flex-direction:column/)
})

test('mobile mosaic keeps the selected pattern while grid stays uniform', () => {
  const html = renderToStaticMarkup(<GallerySection previewMode="catalog" config={{
    editorialVersion: '2',
    layout: 'mosaic',
    mosaicPattern: 'editorial',
    maxItems: '3',
  }} />)
  assert.match(html, /data-gallery-layout="mosaic"/)
  assert.match(html, /data-mosaic-pattern="editorial"/)
  assert.match(html, /data-count="3"/)
  assert.match(html, /data-mosaic-pattern="editorial"\]:is\(\[data-count="3"\],[^}]*grid-column:1\/-1!important;grid-row:span 2!important/)
})

test('mosaic exposes editorial, spotlight and collage shape contracts', () => {
  for (const mosaicPattern of ['editorial', 'spotlight', 'collage']) {
    const html = renderToStaticMarkup(<GallerySection previewMode="catalog" config={{
      editorialVersion: '2',
      layout: 'mosaic',
      mosaicPattern,
      maxItems: '5',
    }} />)
    assert.match(html, new RegExp(`data-mosaic-pattern="${mosaicPattern}"`))
  }
})

test('grid layout keeps its selected column count and uniform row contract', () => {
  const html = renderToStaticMarkup(<GallerySection previewMode="catalog" config={{
    editorialVersion: '2',
    layout: 'grid',
    columns: '3',
    maxItems: '3',
  }} />)
  assert.match(html, /data-gallery-layout="grid"/)
  assert.match(html, /data-layout="grid"/)
  assert.match(html, /data-columns="3"/)
  assert.match(html, /--gallery-columns:3/)
  assert.doesNotMatch(html, /@container \(max-width:520px\)\{[^]*data-layout="grid"\]\{grid-template-columns:repeat\(2/)
  assert.match(html, /@container \(max-width:280px\)\{[^]*data-layout="grid"\]\[data-columns="3"\]\{grid-template-columns:repeat\(2/)
  assert.doesNotMatch(html, /data-gallery-layout="mosaic"/)
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
