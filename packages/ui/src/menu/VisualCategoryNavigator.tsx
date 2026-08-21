'use client'

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { useTheme } from './ThemeContext'
import type { MenuCategory } from './types'

type VisualStage = 'roots' | 'children' | 'products'

interface VisualCategoryNavigatorProps {
  stage: VisualStage
  roots: MenuCategory[]
  children: MenuCategory[]
  activeRootId: string
  activeCategoryId: string
  selectedRootId?: string
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }> | undefined
  statusMessage?: string
  onSelectRoot: (id: string) => void
  onSelectChild: (id: string) => void
  onBack: () => void
  products: ReactNode
}

const DENSITY_INDEX = { compact: 0, normal: 1, comfortable: 2 } as const

function valueForDensity(values: readonly [number, number, number], density: keyof typeof DENSITY_INDEX) {
  return values[DENSITY_INDEX[density]]
}

function placementFor(position: string): CSSProperties {
  if (position === 'bottom-left') return { inset: 'auto auto 12px 12px', alignItems: 'flex-start' }
  if (position === 'bottom-center') return { inset: 'auto 12px 12px', alignItems: 'center' }
  if (position === 'bottom-right') return { inset: 'auto 12px 12px auto', alignItems: 'flex-end' }
  if (position === 'top-left') return { inset: '12px auto auto 12px', alignItems: 'flex-start' }
  if (position === 'top-center') return { inset: '12px 12px auto', alignItems: 'center' }
  if (position === 'top-right') return { inset: '12px 12px auto auto', alignItems: 'flex-end' }
  return { inset: 12, alignItems: 'center', justifyContent: 'center' }
}

function textAlignFor(position: string): CSSProperties['textAlign'] {
  if (position.endsWith('left')) return 'left'
  if (position.endsWith('right')) return 'right'
  return 'center'
}

export function VisualCategoryNavigator({
  stage,
  roots,
  children,
  activeRootId,
  activeCategoryId,
  selectedRootId = '',
  categoryMeta = {},
  statusMessage = '',
  onSelectRoot,
  onSelectChild,
  onBack,
  products,
}: VisualCategoryNavigatorProps) {
  const { theme } = useTheme()
  const density = theme.catnavDensity ?? 'normal'
  const visualStyle = theme.catnavVisualStyle ?? 'compact'
  const overlayOpacity = Math.max(0, Math.min(90, theme.catnavOverlayOpacity ?? 45)) / 100
  const overlayBlur = Math.max(0, Math.min(14, theme.catnavOverlayBlur ?? 0))
  const overlayColor = theme.catnavOverlayColor ?? '#000000'
  const overlayTextColor = theme.catnavOverlayTextColor ?? '#ffffff'
  const radius = Math.max(0, Math.min(40, theme.catnavVisualRadius ?? 22))
  const compactHeight = valueForDensity([88, 104, 120], density)
  const overlayHeight = valueForDensity([104, 128, 152], density)
  const posterImageHeight = valueForDensity([112, 136, 160], density)
  const posterCopyHeight = valueForDensity([52, 56, 60], density)
  const compactImageSize = valueForDensity([64, 76, 88], density)
  const overlayPosition = theme.catnavOverlayTextPosition ?? 'center'

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, items: MenuCategory[], onSelect: (id: string) => void) => {
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? Math.min(items.length - 1, index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? Math.max(0, index - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : null
    if (nextIndex === null || nextIndex === index) return
    const next = items[nextIndex]
    if (!next) return
    event.preventDefault()
    onSelect(next.id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[data-visual-category-card]')[nextIndex]?.focus()
  }

  const renderGrid = (items: MenuCategory[], activeId: string, onSelect: (id: string) => void) => (
    <section
      data-component="visual-category-grid"
      style={{
        padding: `${theme.navTopGap ?? 16}px var(--p-pad) ${theme.navBottomGap ?? 14}px`,
        containerType: 'inline-size',
      }}
    >
      <div data-visual-category-grid-items>
        {items.map((category, index) => {
          const meta = categoryMeta[category.id]
          const isActive = activeId === category.id
          const imageStyle: CSSProperties = meta?.imageUrl
            ? { backgroundImage: `url("${meta.imageUrl}")`, backgroundPosition: 'center', backgroundSize: 'cover' }
            : { background: 'linear-gradient(135deg, color-mix(in srgb, var(--p-card) 88%, var(--p-accent-soft)), var(--p-accent-soft))' }
          const count = meta?.itemCount ?? 0
          const label = theme.catnavShowCount ? `${category.name}, ${count} ürün` : category.name
          return (
            <button
              key={category.id}
              type="button"
              data-visual-category-card
              data-visual-style={visualStyle}
              aria-current={isActive ? 'location' : undefined}
              aria-label={label}
              onClick={() => onSelect(category.id)}
              onKeyDown={(event) => handleGridKeyDown(event, index, items, onSelect)}
              style={{
                width: '100%',
                maxWidth: 420,
                minWidth: 0,
                minHeight: visualStyle === 'overlay' ? overlayHeight : visualStyle === 'poster' ? posterImageHeight + posterCopyHeight : compactHeight,
                padding: visualStyle === 'overlay' || visualStyle === 'poster' ? 0 : 10,
                border: isActive ? '2px solid var(--p-accent)' : 'var(--p-border-w) solid var(--p-border)',
                borderRadius: radius,
                background: 'var(--p-card)',
                color: 'var(--p-text)',
                boxShadow: isActive ? '0 14px 30px -20px color-mix(in srgb, var(--p-accent) 80%, #000), var(--p-shadow)' : 'var(--p-shadow)',
                overflow: 'hidden',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                position: 'relative',
                display: visualStyle === 'poster' ? 'grid' : 'flex',
                alignItems: visualStyle === 'compact' ? 'center' : 'stretch',
                gap: visualStyle === 'compact' ? 12 : 0,
                transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
              }}
            >
              {visualStyle === 'overlay' ? (
                <>
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 0, ...imageStyle }}>
                    {!meta?.imageUrl && <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--p-text-2)' }}><ImageIcon size={26} /></span>}
                  </span>
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: overlayColor, opacity: overlayOpacity, backdropFilter: overlayBlur ? `blur(${overlayBlur}px)` : undefined, WebkitBackdropFilter: overlayBlur ? `blur(${overlayBlur}px)` : undefined, pointerEvents: 'none' }} />
                  <span style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 'calc(100% - 24px)', ...placementFor(overlayPosition), textAlign: textAlignFor(overlayPosition) }}>
                    <span data-visual-caption style={{ maxWidth: '100%', padding: '7px 10px', borderRadius: Math.min(12, Math.max(6, radius / 2)), background: overlayColor, color: overlayTextColor, boxShadow: '0 4px 18px rgba(0,0,0,.18)' }}>
                      <strong style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', fontSize: 'clamp(13px, var(--p-fs), 18px)', lineHeight: 1.15 }}>{category.name}</strong>
                      {theme.catnavShowCount && <small style={{ display: 'block', marginTop: 3, fontSize: 11, fontWeight: 750 }}>{count} ürün</small>}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true" style={{ ...imageStyle, width: visualStyle === 'poster' ? '100%' : compactImageSize, height: visualStyle === 'poster' ? posterImageHeight : compactImageSize, borderRadius: visualStyle === 'poster' ? 0 : Math.max(8, radius - 6), flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--p-text-2)', overflow: 'hidden' }}>
                    {!meta?.imageUrl && <ImageIcon size={visualStyle === 'poster' ? 28 : 22} />}
                  </span>
                  <span style={{ minWidth: 0, minHeight: visualStyle === 'poster' ? posterCopyHeight : undefined, padding: visualStyle === 'poster' ? '9px 11px' : 0, display: 'grid', alignContent: 'center', gap: 3, textAlign: visualStyle === 'poster' ? 'center' : 'left', background: isActive ? 'var(--p-accent-soft)' : 'var(--p-card)' }}>
                    <strong style={{ color: 'var(--p-accent)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', fontSize: 'clamp(13px, var(--p-fs), 18px)', lineHeight: 1.15 }}>{category.name}</strong>
                    {theme.catnavShowCount && <small style={{ color: 'var(--p-text-2)', fontSize: 11, fontWeight: 700 }}>{count} ürün</small>}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div data-visual-category-navigator>
      <style>{`
        [data-visual-category-grid-items]{display:grid;grid-template-columns:minmax(0,420px);justify-content:center;gap:12px}
        [data-visual-category-card]:focus-visible,[data-visual-category-back]:focus-visible{outline:2px solid var(--p-accent);outline-offset:2px}
        @container (min-width:560px){[data-visual-category-grid-items]{grid-template-columns:repeat(2,minmax(0,420px));gap:14px}}
        @container (min-width:900px){[data-visual-category-grid-items]{grid-template-columns:repeat(3,minmax(0,420px));gap:16px}}
        @container (min-width:1280px){[data-visual-category-grid-items]{grid-template-columns:repeat(4,minmax(0,420px))}}
        @media (hover:hover) and (pointer:fine){[data-visual-category-card]:hover{transform:translateY(-2px);box-shadow:0 14px 28px -22px rgba(15,17,21,.34),var(--p-shadow)}}
        @media (prefers-reduced-motion:reduce){[data-visual-category-card]{transition:none!important}}
      `}</style>
      {statusMessage && <span role="status" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{statusMessage}</span>}
      {stage !== 'roots' && (
        <div style={{ padding: `${theme.navTopGap ?? 12}px var(--p-pad) 0`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <button data-visual-category-back type="button" aria-label="Bir önceki kategori seviyesine dön" onClick={onBack} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--p-text)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
            <span data-visual-back-surface aria-hidden="true" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 999, border: 'var(--p-border-w) solid var(--p-border)', background: 'var(--p-card)' }}><ArrowLeft size={18} strokeWidth={2} /></span>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--p-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Kategoriler · {roots.find((category) => category.id === activeRootId)?.name ?? 'Kategori'}</div>
            <div style={{ marginTop: 2, fontFamily: 'var(--p-display)', fontWeight: 800, fontSize: 20, color: 'var(--p-accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage === 'products' ? (children.find((category) => category.id === activeCategoryId)?.name ?? roots.find((category) => category.id === activeRootId)?.name) : roots.find((category) => category.id === activeRootId)?.name}</div>
          </div>
        </div>
      )}
      {stage === 'roots' && renderGrid(roots, selectedRootId, onSelectRoot)}
      {stage === 'children' && renderGrid(children, activeCategoryId, onSelectChild)}
      {stage === 'products' && products}
    </div>
  )
}

export type { VisualStage }
