'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react'

import { makeReaders, customSectionShell } from '../lib/sectionHelpers'
import { isSafeGalleryTarget, resolveGallery, type GalleryPreviewMode, type GalleryTile } from './galleryModel'

export { resolveGallery } from './galleryModel'

export function resolveGalleryTiles(config: Record<string, string>, previewMode?: GalleryPreviewMode) {
  const mode = previewMode ?? (config.catalogMock === 'true' ? 'catalog' : 'public')
  return resolveGallery(config, mode).tiles
}

function legacyTileStyle(layout: string, columns: number, rowHeight: number, gap: number, index: number): CSSProperties {
  if (layout === 'strip') return { flex: '0 0 76%', minHeight: rowHeight * 1.45, aspectRatio: '4 / 3' }
  if (layout === 'grid') return { minHeight: rowHeight, aspectRatio: columns === 3 ? '1 / 1' : '4 / 3' }
  if (index === 0) return { gridColumn: 'span 4', gridRow: 'span 2', minHeight: rowHeight * 2 + gap }
  return { gridColumn: 'span 2', minHeight: rowHeight }
}

function GalleryLightbox({ tiles, index, onIndex, onClose }: {
  tiles: GalleryTile[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pointerStart = useRef<number | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const activeTile = tiles[index]

  useEffect(() => setImageFailed(false), [activeTile?.imageUrl])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); onClose()
      } else if (event.key === 'ArrowLeft' && tiles.length > 1) {
        event.preventDefault(); onIndex((index - 1 + tiles.length) % tiles.length)
      } else if (event.key === 'ArrowRight' && tiles.length > 1) {
        event.preventDefault(); onIndex((index + 1) % tiles.length)
      } else if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        if (focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus()
        }
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => dialog.removeEventListener('keydown', onKeyDown)
  }, [index, onClose, onIndex, tiles.length])

  if (!activeTile?.imageUrl) return null
  const previous = () => onIndex((index - 1 + tiles.length) % tiles.length)
  const next = () => onIndex((index + 1) % tiles.length)
  const onPointerDown = (event: ReactPointerEvent) => { pointerStart.current = event.clientX }
  const onPointerUp = (event: ReactPointerEvent) => {
    if (pointerStart.current === null || tiles.length < 2) return
    const distance = event.clientX - pointerStart.current
    pointerStart.current = null
    if (Math.abs(distance) < 44) return
    if (distance > 0) previous(); else next()
  }

  return createPortal(
    <dialog ref={dialogRef} aria-label="Galeri fotoğrafı" className="garsonless-gallery-lightbox" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <button ref={closeRef} type="button" aria-label="Galeriyi kapat" className="garsonless-gallery-lightbox__close" onClick={onClose}><X size={22} /></button>
      <div className="garsonless-gallery-lightbox__stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <figure>
          {imageFailed
            ? <span className="garsonless-gallery-lightbox__fallback" role="img" aria-label="Fotoğraf yüklenemedi"><ImageOff size={36} aria-hidden /></span>
            : <img src={activeTile.imageUrl} alt={activeTile.label || `Galeri fotoğrafı ${index + 1}`} onError={() => setImageFailed(true)} />}
          {activeTile.label && <figcaption>{activeTile.label}</figcaption>}
        </figure>
      </div>
      <div className="garsonless-gallery-lightbox__controls">
        {tiles.length > 1 && <button type="button" aria-label="Önceki fotoğraf" onClick={previous}><ChevronLeft size={25} /></button>}
        <span aria-live="polite">{index + 1} / {tiles.length}</span>
        {tiles.length > 1 && <button type="button" aria-label="Sonraki fotoğraf" onClick={next}><ChevronRight size={25} /></button>}
      </div>
    </dialog>,
    document.body,
  )
}

export function GallerySection({ config, previewMode = 'public' }: { config: Record<string, string>, previewMode?: GalleryPreviewMode }) {
  const { text, bool } = makeReaders(config)
  const gallery = useMemo(() => resolveGallery(config, previewMode), [config, previewMode])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const lastTriggerId = useRef<string | null>(null)
  const { isModern, tiles, layout, mosaicPattern, columns, imageFit, imagePosition, radius, gap, rowHeight, padding } = gallery
  const accentColor = text('accentColor', 'var(--p-accent)')
  const sectionBgColor = text('sectionBgColor', 'var(--p-card)')
  const titleColor = text('titleColor', isModern ? 'var(--p-text)' : accentColor)
  const bodyColor = text('bodyColor', 'var(--p-text-2)')
  const labelBgColor = text('labelBgColor', '#ffffff')
  const labelTextColor = text('labelTextColor', accentColor)
  const showTitle = bool('showTitle', true)
  const showBody = bool('showBody', true)
  const showLabels = bool('showLabels', true)
  const enableLightbox = bool('enableLightbox', true)
  const rawTargetUrl = text('targetUrl', '')
  const targetUrl = text('targetType', 'none') === 'link' && isSafeGalleryTarget(rawTargetUrl) ? rawTargetUrl : ''

  useEffect(() => {
    if (activeIndex !== null && (activeIndex >= tiles.length || !tiles[activeIndex]?.imageUrl)) setActiveIndex(null)
  }, [activeIndex, tiles])

  if (tiles.length === 0) return null

  const closeLightbox = () => {
    const id = lastTriggerId.current
    setActiveIndex(null)
    window.requestAnimationFrame(() => { if (id) triggerRefs.current.get(id)?.focus() })
  }
  const openLightbox = (tile: GalleryTile, index: number) => {
    lastTriggerId.current = tile.id
    setActiveIndex(index)
  }
  const legacyLayout: CSSProperties = layout === 'strip'
    ? { display: 'flex', gap, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 3 }
    : layout === 'grid'
      ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }
      : { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridAutoRows: rowHeight, gap }
  const cssVariables = {
    '--gallery-gap': `${gap}px`, '--gallery-row-height': `${rowHeight}px`, '--gallery-big-height': `${rowHeight * 2 + gap}px`,
    '--gallery-strip-height': `${Math.round(rowHeight * 1.45)}px`, '--gallery-radius': `${Math.max(4, radius - 4)}px`, '--gallery-columns': columns,
  } as CSSProperties

  return (
    <section data-component="custom-section" data-gallery-layout={layout} data-gallery-version={isModern ? '2' : '1'} style={{ ...customSectionShell, containerType: isModern ? 'inline-size' : undefined }}>
      <style>{galleryStyles}</style>
      <div className={isModern ? 'garsonless-gallery-v2' : undefined} style={{ background: sectionBgColor, borderRadius: radius, padding }}>
        {(showTitle || targetUrl) && (
          <div className={isModern ? 'garsonless-gallery-v2__header' : undefined} style={!isModern ? { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: showBody ? 5 : 12 } : undefined}>
            {showTitle ? (isModern
              ? <h2 style={{ color: titleColor }}>{text('title', 'Mekândan Kareler')}</h2>
              : <h3 style={{ margin: 0, color: titleColor, fontFamily: 'var(--p-display)', fontSize: 21, fontWeight: 750, letterSpacing: '-0.015em' }}>{text('title', 'Mekândan Kareler')}</h3>
            ) : <span />}
            {targetUrl && <a className={isModern ? 'garsonless-gallery-v2__link' : undefined} href={targetUrl} target="_blank" rel="noopener noreferrer" style={!isModern ? { color: accentColor, fontSize: 11.5, fontWeight: 750, textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 } : { color: accentColor }}><span>{text('linkText', 'Hepsini gör')}</span> <ExternalLink size={14} aria-hidden /></a>}
          </div>
        )}
        {showBody && <p className={isModern ? 'garsonless-gallery-v2__body' : undefined} style={{ margin: isModern ? undefined : `0 0 ${showTitle || targetUrl ? 12 : 10}px`, color: bodyColor, fontSize: isModern ? undefined : 12, lineHeight: 1.45 }}>{text('body', 'Mekânımızdan ve mutfağımızdan kareler')}</p>}
        <div className={isModern ? 'garsonless-gallery-v2__tiles' : undefined} data-layout={layout} data-mosaic-pattern={mosaicPattern} data-columns={columns} data-count={tiles.length} style={isModern ? cssVariables : legacyLayout}>
          {tiles.map((tile, index) => {
            const failureKey = `${tile.id}:${tile.imageUrl}`
            const imageFailed = failed.has(failureKey)
            const clickable = enableLightbox && Boolean(tile.imageUrl) && !imageFailed
            const content = <>
              {tile.imageUrl && !imageFailed ? <img src={tile.imageUrl} alt={tile.label || `${text('title', 'Foto Galerisi')} fotoğrafı ${index + 1}`} loading="lazy" decoding="async" onError={() => setFailed((current) => new Set(current).add(failureKey))} style={{ width: '100%', height: '100%', display: 'block', objectFit: imageFit, objectPosition: imagePosition, background: 'var(--p-bg)' }} />
                : tile.mockGradient ? <span aria-hidden className="garsonless-gallery-v2__mock" style={{ background: tile.mockGradient }} />
                  : <span className="garsonless-gallery-v2__fallback" role="img" aria-label="Fotoğraf yüklenemedi"><ImageOff size={24} aria-hidden /></span>}
              {showLabels && tile.label && <span className="garsonless-gallery-v2__label" style={{ background: labelBgColor, color: labelTextColor }}>{tile.label}</span>}
              {clickable && <span aria-hidden className="garsonless-gallery-v2__camera"><Camera size={13} /></span>}
            </>
            const legacyStyle = !isModern ? { ...legacyTileStyle(layout, columns, rowHeight, gap, index), position: 'relative', overflow: 'hidden', borderRadius: Math.max(4, radius - 4), border: 'none', padding: 0, background: tile.mockGradient || 'var(--p-bg)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.055)', scrollSnapAlign: 'start' } as CSSProperties : undefined
            return clickable ? <button key={tile.id} ref={(node) => { if (node) triggerRefs.current.set(tile.id, node); else triggerRefs.current.delete(tile.id) }} type="button" className={isModern ? 'garsonless-gallery-v2__tile is-clickable' : undefined} onClick={() => openLightbox(tile, index)} aria-label={`${tile.label || `Fotoğraf ${index + 1}`} büyük görüntüsünü aç`} style={legacyStyle}>{content}</button>
              : <div key={tile.id} className={isModern ? 'garsonless-gallery-v2__tile' : undefined} style={legacyStyle}>{content}</div>
          })}
        </div>
      </div>
      {activeIndex !== null && typeof document !== 'undefined' && <GalleryLightbox tiles={tiles} index={activeIndex} onIndex={setActiveIndex} onClose={closeLightbox} />}
    </section>
  )
}

const galleryStyles = `
.garsonless-gallery-v2{display:grid;gap:14px;font-family:var(--p-body,inherit);box-sizing:border-box}
.garsonless-gallery-v2__header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0}
.garsonless-gallery-v2__header h2{min-width:0;margin:0;font-family:var(--p-body,inherit);font-size:21px;font-weight:700;line-height:1.2;letter-spacing:-.015em;overflow-wrap:anywhere}
.garsonless-gallery-v2__link{display:inline-flex;align-items:center;justify-content:center;justify-self:end;gap:6px;min-height:44px;max-width:100%;padding:0 3px;font-size:12px;font-weight:750;line-height:1.2;text-align:right;text-decoration:none}.garsonless-gallery-v2__link span{overflow-wrap:anywhere}
.garsonless-gallery-v2__link:focus-visible,.garsonless-gallery-v2__tile.is-clickable:focus-visible{outline:3px solid color-mix(in srgb,var(--p-accent) 45%,transparent);outline-offset:3px}
.garsonless-gallery-v2__body{margin:-6px 0 0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.garsonless-gallery-v2__tiles{min-width:0;gap:var(--gallery-gap)}
.garsonless-gallery-v2__tiles[data-layout="mosaic"]{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:var(--gallery-row-height)}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="1"]{grid-template-columns:1fr;grid-auto-rows:var(--gallery-big-height)}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:var(--gallery-big-height)}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="3"] .garsonless-gallery-v2__tile:first-child,.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="5"] .garsonless-gallery-v2__tile:first-child,.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="6"] .garsonless-gallery-v2__tile:first-child{grid-column:span 4;grid-row:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="3"] .garsonless-gallery-v2__tile:not(:first-child),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="5"] .garsonless-gallery-v2__tile:nth-child(2),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="5"] .garsonless-gallery-v2__tile:nth-child(3),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="6"] .garsonless-gallery-v2__tile:nth-child(2),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="6"] .garsonless-gallery-v2__tile:nth-child(3){grid-column:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="5"] .garsonless-gallery-v2__tile:nth-child(n+4){grid-column:span 3}.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="6"] .garsonless-gallery-v2__tile:nth-child(n+4){grid-column:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="spotlight"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile{grid-column:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="spotlight"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:first-child{grid-column:span 6;grid-row:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="spotlight"]:is([data-count="3"],[data-count="5"]) .garsonless-gallery-v2__tile:not(:first-child){grid-column:span 3}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="spotlight"][data-count="6"] .garsonless-gallery-v2__tile:nth-child(n+5){grid-column:span 3}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+1),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+4),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+5){grid-column:span 4}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+2),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+3),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+6){grid-column:span 2}
.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="5"]) .garsonless-gallery-v2__tile:last-child{grid-column:span 6}
.garsonless-gallery-v2__tiles[data-layout="grid"]{display:grid;grid-template-columns:repeat(var(--gallery-columns),minmax(0,1fr));grid-auto-rows:var(--gallery-row-height)}
.garsonless-gallery-v2__tiles[data-layout="strip"]{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:3px}.garsonless-gallery-v2__tiles[data-layout="strip"] .garsonless-gallery-v2__tile{flex:0 0 min(76%,420px);height:var(--gallery-strip-height);scroll-snap-align:start}
.garsonless-gallery-v2__tile{position:relative;min-width:0;height:100%;overflow:hidden;border:0;border-radius:var(--gallery-radius);padding:0;background:var(--p-bg);box-shadow:inset 0 0 0 1px rgba(0,0,0,.055);font:inherit}.garsonless-gallery-v2__tile img,.garsonless-gallery-v2__mock,.garsonless-gallery-v2__fallback{position:absolute;inset:0;width:100%;height:100%;display:block}
.garsonless-gallery-v2__fallback{display:grid;place-items:center;color:var(--p-text-2);background:color-mix(in srgb,var(--p-bg) 92%,var(--p-text) 8%)}.garsonless-gallery-v2__tile.is-clickable{cursor:zoom-in}
@media (hover:hover){.garsonless-gallery-v2__tile.is-clickable img{transition:transform 180ms ease}.garsonless-gallery-v2__tile.is-clickable:hover img{transform:scale(1.025)}}
.garsonless-gallery-v2__label{position:absolute;left:9px;bottom:9px;max-width:calc(100% - 18px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 9px;border-radius:999px;font-size:10.5px;line-height:1;font-weight:750;box-shadow:0 5px 18px rgba(0,0,0,.12)}.garsonless-gallery-v2__camera{position:absolute;right:9px;top:9px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(0,0,0,.42);backdrop-filter:blur(7px)}
.garsonless-gallery-lightbox{width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:16px;border:0;background:rgba(10,11,12,.9);color:#fff;box-sizing:border-box}.garsonless-gallery-lightbox::backdrop{background:rgba(10,11,12,.7);backdrop-filter:blur(10px)}
.garsonless-gallery-lightbox__close{position:absolute;z-index:2;top:16px;right:16px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);color:#fff;background:rgba(255,255,255,.13);display:grid;place-items:center;cursor:pointer}.garsonless-gallery-lightbox__stage{height:calc(100% - 64px);display:grid;place-items:center;padding:48px 0 12px;box-sizing:border-box;touch-action:pan-y}
.garsonless-gallery-lightbox figure{max-width:min(980px,92vw);max-height:100%;margin:0;display:grid;gap:10px;justify-items:center}.garsonless-gallery-lightbox figure img{display:block;max-width:100%;max-height:calc(100dvh - 150px);border-radius:16px;object-fit:contain;box-shadow:0 24px 80px rgba(0,0,0,.38)}.garsonless-gallery-lightbox figcaption{max-width:min(760px,88vw);text-align:center;font-size:13px;font-weight:650;line-height:1.4;overflow-wrap:anywhere}
.garsonless-gallery-lightbox__fallback{width:min(720px,86vw);height:min(520px,60vh);border-radius:16px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.1)}
.garsonless-gallery-lightbox__controls{height:56px;display:flex;align-items:center;justify-content:center;gap:20px}.garsonless-gallery-lightbox__controls button{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);color:#fff;background:rgba(255,255,255,.13);display:grid;place-items:center;cursor:pointer}.garsonless-gallery-lightbox button:focus-visible{outline:3px solid #fff;outline-offset:3px}
@container (max-width:520px){
  .garsonless-gallery-v2__header{gap:8px}
  .garsonless-gallery-v2__tiles[data-layout="strip"] .garsonless-gallery-v2__tile{flex-basis:86%}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:var(--gallery-row-height)}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"] .garsonless-gallery-v2__tile{grid-column:span 1!important;grid-row:span 1!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="1"] .garsonless-gallery-v2__tile:first-child{grid-column:1/-1!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="1"],.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="2"]{grid-auto-rows:var(--gallery-big-height)}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"]:is([data-count="3"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:first-child{grid-column:1/-1!important;grid-row:span 2!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="editorial"][data-count="6"] .garsonless-gallery-v2__tile:last-child{grid-column:1/-1!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="spotlight"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:first-child{grid-column:1/-1!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+1),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+4),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+5){grid-column:span 2!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+2),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+3),.garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="4"],[data-count="5"],[data-count="6"]) .garsonless-gallery-v2__tile:nth-child(6n+6){grid-column:span 1!important}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-mosaic-pattern="collage"]:is([data-count="3"],[data-count="5"]) .garsonless-gallery-v2__tile:last-child{grid-column:1/-1!important}
}
@container (max-width:280px){
  .garsonless-gallery-v2__tiles[data-layout="grid"][data-columns="3"]{grid-template-columns:repeat(2,minmax(0,1fr))}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"]{grid-template-columns:1fr}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"]{grid-auto-rows:auto}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"] .garsonless-gallery-v2__tile{grid-column:span 1!important;grid-row:span 1!important;height:var(--gallery-row-height)}
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="1"] .garsonless-gallery-v2__tile:first-child,
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="3"] .garsonless-gallery-v2__tile:first-child,
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="5"] .garsonless-gallery-v2__tile:first-child,
  .garsonless-gallery-v2__tiles[data-layout="mosaic"][data-count="6"] .garsonless-gallery-v2__tile:first-child{height:var(--gallery-big-height)}
}
@container (max-width:190px){.garsonless-gallery-v2__tiles[data-layout="grid"]{grid-template-columns:1fr}}
`
