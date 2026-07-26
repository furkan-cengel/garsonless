'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Camera, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'

import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

const GALLERY_KEYS = ['tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'] as const
const CATALOG_GRADIENTS = [
  'linear-gradient(135deg, #d8efe3 0%, #f7dfce 100%)',
  'linear-gradient(135deg, #efe5d5 0%, #dcece5 100%)',
  'linear-gradient(135deg, #eadceb 0%, #f8e9d8 100%)',
  'linear-gradient(135deg, #d8e8f2 0%, #e8efd8 100%)',
  'linear-gradient(135deg, #f3dfce 0%, #eee8d9 100%)',
  'linear-gradient(135deg, #dbe9dc 0%, #e4def0 100%)',
]

type GalleryTile = {
  id: string
  imageUrl: string
  label: string
  mockGradient?: string
}

export function resolveGalleryTiles(config: Record<string, string>): GalleryTile[] {
  const requestedOrder = (config.tileOrder ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key): key is typeof GALLERY_KEYS[number] => GALLERY_KEYS.includes(key as typeof GALLERY_KEYS[number]))
  const order = [...new Set([...requestedOrder, ...GALLERY_KEYS])]
  const limit = Math.max(1, Math.min(6, Number(config.maxItems) || 6))
  const actual = order
    .map((id) => ({
      id,
      imageUrl: config[`${id}Image`]?.trim() ?? '',
      label: config[`${id}Label`]?.trim() ?? '',
    }))
    .filter((tile) => tile.imageUrl)
    .slice(0, limit)

  if (actual.length > 0 || config.catalogMock !== 'true') return actual

  return order.slice(0, Math.min(limit, 5)).map((id, index) => ({
    id,
    imageUrl: '',
    label: config[`${id}Label`]?.trim() || ['İç mekân', 'Kahve', 'Mutfaktan', 'Detaylar', 'Tatlılar'][index] || '',
    mockGradient: CATALOG_GRADIENTS[index]!,
  }))
}

function tileGridStyle(layout: string, columns: number, rowHeight: number, index: number): CSSProperties {
  if (layout === 'strip') {
    return { flex: '0 0 76%', minHeight: rowHeight * 1.45, aspectRatio: '4 / 3' }
  }
  if (layout === 'grid') {
    return { minHeight: rowHeight, aspectRatio: columns === 3 ? '1 / 1' : '4 / 3' }
  }
  if (index === 0) {
    return { gridColumn: 'span 4', gridRow: 'span 2', minHeight: rowHeight * 2 + 8 }
  }
  return { gridColumn: 'span 2', minHeight: rowHeight }
}

export function GallerySection({ config }: { config: Record<string, string> }) {
  const { text, number, bool } = makeReaders(config)
  const tiles = useMemo(() => resolveGalleryTiles(config), [config])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const layout = text('layout', 'mosaic')
  const columns = text('columns', '2') === '3' ? 3 : 2
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = text('imagePosition', 'center')
  const radius = number('radius', 16)
  const gap = number('gap', 8)
  const rowHeight = number('rowHeight', 104)
  const padding = number('padding', 14)
  const accentColor = text('accentColor', 'var(--p-accent)')
  const sectionBgColor = text('sectionBgColor', 'var(--p-card)')
  const titleColor = text('titleColor', accentColor)
  const bodyColor = text('bodyColor', 'var(--p-text-2)')
  const labelBgColor = text('labelBgColor', '#ffffff')
  const labelTextColor = text('labelTextColor', accentColor)
  const showTitle = bool('showTitle', true)
  const showBody = bool('showBody', true)
  const showLabels = bool('showLabels', true)
  const enableLightbox = bool('enableLightbox', true)
  const targetUrl = text('targetType', 'none') === 'link' && /^https?:\/\//i.test(text('targetUrl', ''))
    ? text('targetUrl', '')
    : ''

  useEffect(() => {
    if (activeIndex === null) return
    if (tiles.length === 0 || activeIndex >= tiles.length) {
      setActiveIndex(null)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowLeft') setActiveIndex((current) => current === null ? null : (current - 1 + tiles.length) % tiles.length)
      if (event.key === 'ArrowRight') setActiveIndex((current) => current === null ? null : (current + 1) % tiles.length)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeIndex, tiles.length])

  if (tiles.length === 0) return null

  const galleryLayout: CSSProperties = layout === 'strip'
    ? { display: 'flex', gap, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 3 }
    : layout === 'grid'
      ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }
      : { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridAutoRows: rowHeight, gap }

  const activeTile = activeIndex === null ? null : tiles[activeIndex]
  const safeActiveIndex = activeIndex ?? 0

  return (
    <section data-component="custom-section" data-gallery-layout={layout} style={customSectionShell}>
      <div style={{ background: sectionBgColor, borderRadius: radius, padding }}>
        {(showTitle || targetUrl) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: showBody ? 5 : 12 }}>
            {showTitle ? (
              <h3 style={{ margin: 0, color: titleColor, fontFamily: 'var(--p-display)', fontSize: 21, fontWeight: 750, letterSpacing: '-0.015em' }}>
                {text('title', 'Mekândan Kareler')}
              </h3>
            ) : <span />}
            {targetUrl && (
              <a href={targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: accentColor, fontSize: 11.5, fontWeight: 750, textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {text('linkText', 'Hepsini gör')} <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </div>
        )}
        {showBody && (
          <p style={{ margin: `0 0 ${showTitle || targetUrl ? 12 : 10}px`, color: bodyColor, fontSize: 12, lineHeight: 1.45 }}>
            {text('body', 'Mekânımızdan ve mutfağımızdan kareler')}
          </p>
        )}
        <div style={galleryLayout}>
          {tiles.map((tile, index) => {
            const tileStyle = tileGridStyle(layout, columns, rowHeight, index)
            const content = (
              <>
                {tile.imageUrl ? (
                  <img
                    src={tile.imageUrl}
                    alt={tile.label || `${text('title', 'Foto Galerisi')} fotoğrafı ${index + 1}`}
                    style={{ width: '100%', height: '100%', display: 'block', objectFit: imageFit, objectPosition: imagePosition, background: 'var(--p-bg)' }}
                  />
                ) : (
                  <span aria-hidden style={{ position: 'absolute', inset: 0, background: tile.mockGradient }} />
                )}
                {showLabels && tile.label && (
                  <span style={{ position: 'absolute', left: 9, bottom: 9, maxWidth: 'calc(100% - 18px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: labelBgColor, color: labelTextColor, padding: '5px 9px', borderRadius: 999, fontSize: 10.5, lineHeight: 1, fontWeight: 750, boxShadow: '0 5px 18px rgba(0,0,0,.12)' }}>
                    {tile.label}
                  </span>
                )}
                {enableLightbox && tile.imageUrl && <span aria-hidden style={{ position: 'absolute', right: 9, top: 9, width: 25, height: 25, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(7px)' }}><Camera size={13} /></span>}
              </>
            )
            const commonStyle: CSSProperties = {
              ...tileStyle,
              position: 'relative', overflow: 'hidden', borderRadius: Math.max(4, radius - 4),
              border: 'none', padding: 0, background: tile.mockGradient || 'var(--p-bg)',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.055)', scrollSnapAlign: 'start',
            }
            return enableLightbox && tile.imageUrl ? (
              <button key={tile.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`${tile.label || `Fotoğraf ${index + 1}`} büyük görüntüsünü aç`} style={{ ...commonStyle, cursor: 'zoom-in', fontFamily: 'inherit' }}>
                {content}
              </button>
            ) : <div key={tile.id} style={commonStyle}>{content}</div>
          })}
        </div>
      </div>

      {activeTile?.imageUrl && (
        <div role="dialog" aria-modal="true" aria-label="Galeri fotoğrafı" onClick={() => setActiveIndex(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(10,11,12,.82)', backdropFilter: 'blur(12px)' }}>
          <button type="button" aria-label="Galeriyi kapat" onClick={() => setActiveIndex(null)} style={lightboxControlStyle('top-right')}><X size={20} /></button>
          {tiles.length > 1 && (
            <>
              <button type="button" aria-label="Önceki fotoğraf" onClick={(event) => { event.stopPropagation(); setActiveIndex((safeActiveIndex - 1 + tiles.length) % tiles.length) }} style={lightboxControlStyle('left')}><ChevronLeft size={24} /></button>
              <button type="button" aria-label="Sonraki fotoğraf" onClick={(event) => { event.stopPropagation(); setActiveIndex((safeActiveIndex + 1) % tiles.length) }} style={lightboxControlStyle('right')}><ChevronRight size={24} /></button>
            </>
          )}
          <figure onClick={(event) => event.stopPropagation()} style={{ margin: 0, maxWidth: 'min(920px, 88vw)', maxHeight: '84vh', display: 'grid', gap: 10 }}>
            <img src={activeTile.imageUrl} alt={activeTile.label || `Galeri fotoğrafı ${safeActiveIndex + 1}`} style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 24px 80px rgba(0,0,0,.38)' }} />
            {activeTile.label && <figcaption style={{ color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: 650 }}>{activeTile.label}</figcaption>}
          </figure>
        </div>
      )}
    </section>
  )
}

function lightboxControlStyle(position: 'top-right' | 'left' | 'right'): CSSProperties {
  const placement: CSSProperties = position === 'top-right'
    ? { top: 18, right: 18 }
    : position === 'left'
      ? { left: 18, top: '50%', transform: 'translateY(-50%)' }
      : { right: 18, top: '50%', transform: 'translateY(-50%)' }
  return {
    ...placement,
    position: 'fixed', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,.18)',
    color: '#fff', background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', zIndex: 1,
  }
}
