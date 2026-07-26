import React, { type CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem } from '../../../menu/types'
import type { ComboAddRequest } from '../../types'
import { customSectionShell, makeReaders } from '../lib/sectionHelpers'
import { resolveComboRibbonGroups } from './comboRibbonModel'

type ComboRibbonTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const BUTTON_SIZE = { small: 34, medium: 40, large: 46 } as const

export function ComboRibbonSection({
  sectionInstanceId,
  config,
  items = [],
  onAddCombo,
  theme,
}: {
  sectionInstanceId: string
  config: Record<string, string>
  items?: MenuItem[]
  onAddCombo?: (combo: ComboAddRequest) => void
  theme?: ComboRibbonTheme
}) {
  const { text, number, bool } = makeReaders(config)
  const groups = resolveComboRibbonGroups(config, items)
  const layout = text('layout', 'stack') === 'scroll' ? 'scroll' : 'stack'
  const density = text('density', 'comfortable') === 'compact' ? 'compact' : 'comfortable'
  const showTitle = bool('showTitle', true)
  const showImages = bool('showImages', true)
  const showItemNames = bool('showItemNames', true)
  const surfaceColor = text('bgColor', '#fff7dc')
  const titleColor = text('titleColor', '#1c1d20')
  const accentColor = text('accentColor', '#e86b3d')
  const itemSurfaceColor = text('itemBgColor', 'rgba(255,255,255,.22)')
  const itemTextColor = text('itemTextColor', '#ffffff')
  const priceColor = text('priceColor', '#ffffff')
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const buttonStyle = ctaMode === 'inherit' ? (theme?.cardCtaStyle ?? 'pill') : text('buttonStyle', 'pill')
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', '#1c1d20')
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', '#ffffff')
  const cardRadius = number('cardRadius', 16)
  const imageSize = number('imageSize', density === 'compact' ? 36 : 44)

  if (groups.length === 0 && onAddCombo) return null

  return (
    <section id={`custom-section-${sectionInstanceId}`} data-component="custom-section" data-section-kind="combo-ribbon" style={customSectionShell}>
      <style>{`
        .garsonless-combo-card { transition: transform 150ms ease, box-shadow 150ms ease; }
        .garsonless-combo-card:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -20px rgba(0,0,0,.58); }
        .garsonless-combo-add { transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease; }
        .garsonless-combo-add:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 8px 20px -13px currentColor; }
        .garsonless-combo-add:not(:disabled):active { transform: scale(.98); }
        .garsonless-combo-add:focus-visible { outline: 2px solid var(--combo-accent); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-combo-card, .garsonless-combo-add { transition: none !important; }
          .garsonless-combo-card:hover, .garsonless-combo-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div style={{
        '--combo-accent': accentColor,
        background: surfaceColor,
        borderRadius: number('radius', 18),
        padding: density === 'compact' ? 12 : 16,
        overflow: 'hidden',
        boxShadow: 'var(--p-shadow)',
      } as CSSProperties}>
        {showTitle && (
          <h2 style={{
            margin: `0 0 ${density === 'compact' ? 10 : 13}px`,
            color: titleColor,
            fontFamily: 'var(--p-display)',
            fontSize: density === 'compact' ? 18 : 21,
            lineHeight: 1.2,
            fontWeight: 750,
            letterSpacing: '-.01em',
          }}>
            {text('title', 'Birlikte daha güzel')}
          </h2>
        )}

        <div style={{
          display: layout === 'scroll' ? 'flex' : 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: number('cardGap', density === 'compact' ? 9 : 12),
          overflowX: layout === 'scroll' ? 'auto' : 'visible',
          scrollSnapType: layout === 'scroll' ? 'x mandatory' : undefined,
          paddingBottom: layout === 'scroll' ? 4 : 0,
        }}>
          {groups.map((group) => {
            const prefix = `combo${group.index}`
            const cardColor = text(`${prefix}Color`, group.index === 1 ? '#26a69a' : group.index === 2 ? '#ee6c4d' : '#d8a72f')
            const cardTextColor = text(`${prefix}TextColor`, '#ffffff')
            const customTitle = config[`${prefix}Title`]?.trim()
            const cardTitle = customTitle || group.items.map((item) => item.name).join(' + ')
            const badge = config[`${prefix}Badge`]?.trim() || `${group.items.length} ürün`
            const canAdd = Boolean(onAddCombo)

            return (
              <article
                key={group.id}
                className="garsonless-combo-card"
                data-combo-card={group.index}
                data-combo-ready="true"
                style={{
                  minWidth: layout === 'scroll' ? 'min(82vw, 310px)' : 0,
                  scrollSnapAlign: layout === 'scroll' ? 'start' : undefined,
                  background: cardColor,
                  color: cardTextColor,
                  borderRadius: cardRadius,
                  padding: density === 'compact' ? 11 : 13,
                  border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
                  display: 'grid',
                  gap: density === 'compact' ? 9 : 11,
                }}
              >
                <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: 22,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: `color-mix(in srgb, ${accentColor} 82%, #ffffff 18%)`,
                      color: text('badgeTextColor', '#1c1d20'),
                      fontSize: 9.5,
                      fontWeight: 850,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                    }}>{badge}</span>
                    <h3 style={{ margin: '7px 0 0', fontSize: density === 'compact' ? 14 : 15.5, lineHeight: 1.3, fontWeight: 800, color: cardTextColor }}>
                      {cardTitle}
                    </h3>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {group.hasSpecialPrice && <div style={{ color: priceColor, opacity: .68, fontSize: 10.5, textDecoration: 'line-through' }}>{formatTRY(group.catalogTotal)}</div>}
                    <strong style={{ display: 'block', color: priceColor, fontSize: density === 'compact' ? 16 : 18, lineHeight: 1.2 }}>{formatTRY(group.total)}</strong>
                  </div>
                </header>

                <div style={{ display: 'grid', gap: 6 }}>
                  {group.items.map((item) => (
                    <div key={item.id} data-combo-item={item.id} style={{
                      minWidth: 0,
                      minHeight: density === 'compact' ? 42 : 50,
                      padding: density === 'compact' ? 6 : 7,
                      borderRadius: Math.max(8, cardRadius - 5),
                      background: itemSurfaceColor,
                      color: itemTextColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                    }}>
                      {showImages && (
                        <div style={{ width: imageSize, height: imageSize, flexShrink: 0, borderRadius: text('imageShape', 'rounded') === 'circle' ? 999 : 9, overflow: 'hidden', background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
                          {item.images[0] ? (
                            <img src={item.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <AppIcons.image size={18} aria-hidden="true" />
                          )}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {showItemNames && <div style={{ fontSize: 12.5, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>}
                        <div style={{ marginTop: showItemNames ? 2 : 0, fontSize: 11.5, fontWeight: 750, opacity: .82 }}>{formatTRY(item.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <button
                    type="button"
                    className="garsonless-combo-add"
                    data-cta-source={ctaMode}
                    data-cta-icon={buttonIcon}
                    disabled={!canAdd}
                    aria-label={`${cardTitle} ürünlerini sepete ekle`}
                    onClick={() => {
                      if (!canAdd) return
                      onAddCombo?.({ sectionInstanceId, comboIndex: group.index, title: cardTitle, items: group.items, catalogTotal: group.catalogTotal, total: group.total })
                    }}
                    style={{
                      minWidth: buttonStyle === 'icon' ? buttonSize : buttonStyle === 'full' ? '100%' : Math.max(96, buttonSize * 2.4),
                      height: buttonSize,
                      marginLeft: buttonStyle === 'full' ? 0 : 'auto',
                      padding: buttonStyle === 'icon' ? 0 : `0 ${Math.round(buttonSize * .38)}px`,
                      border: 0,
                      borderRadius: 999,
                      background: buttonBackground,
                      color: buttonColor,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontFamily: 'var(--p-body)',
                      fontSize: 11.5,
                      fontWeight: 850,
                      cursor: canAdd ? 'pointer' : 'not-allowed',
                      opacity: canAdd ? 1 : .58,
                    }}
                  >
                    <ComboCtaIcon kind={buttonIcon} size={Math.max(15, Math.round(buttonSize * .42))} />
                    {buttonStyle !== 'icon' && <span>{text('ctaText', 'Komboyu ekle')}</span>}
                  </button>
                </div>
                {group.requiresConfiguration && (
                  <p role="status" style={{ margin: '-3px 0 0', color: cardTextColor, opacity: .76, fontSize: 10.5, lineHeight: 1.4 }}>
                    Seçenekleri sonraki adımda tamamlayabilirsiniz.
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ComboCtaIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === 'cart') return <AppIcons.cart size={size} />
  if (kind === 'bag') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  return <AppIcons.plus size={size} />
}
