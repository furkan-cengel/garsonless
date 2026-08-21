import React, { type CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem } from '../../../menu/types'
import { ProductAllergenSummary } from '../../../menu/FoodInfoBadges'
import type { ComboAddRequest, ComboInteractionState } from '../../types'
import { customSectionShell, makeReaders } from '../lib/sectionHelpers'
import { resolveComboRibbonGroups } from './comboRibbonModel'
import { TAG_SHIMMER_TARGET_CLASS, tagShimmerScopeClass } from '../../../menu/tagShimmer'

type ComboRibbonTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor' | 'motion' | 'tagShimmer'>

interface ComboRibbonSectionProps {
  sectionInstanceId: string
  config: Record<string, string>
  items?: MenuItem[]
  onAddCombo?: (combo: ComboAddRequest) => void
  interactionState?: ComboInteractionState
  theme?: ComboRibbonTheme
}

const BUTTON_SIZE = { small: 44, medium: 46, large: 50 } as const

export function ComboRibbonSection(props: ComboRibbonSectionProps) {
  return props.config.editorialVersion === '2'
    ? ModernComboRibbonSection(props)
    : LegacyComboRibbonSection(props)
}

function LegacyComboRibbonSection({
  sectionInstanceId,
  config,
  items = [],
  onAddCombo,
  interactionState = onAddCombo ? 'enabled' : 'ordering-disabled',
  theme,
}: ComboRibbonSectionProps) {
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

  if (groups.length === 0) return null

  return (
    <section id={`custom-section-${sectionInstanceId}`} className={tagShimmerScopeClass(theme)} data-component="custom-section" data-section-kind="combo-ribbon" style={customSectionShell}>
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
            const canAdd = interactionState === 'enabled' && Boolean(onAddCombo)

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
                    <span className={TAG_SHIMMER_TARGET_CLASS} style={{
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
                            <img src={item.images[0]} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <AppIcons.image size={18} aria-hidden="true" />
                          )}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {showItemNames && <div style={{ fontSize: 12.5, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>}
                        <ProductAllergenSummary item={item} maxVisible={3} style={{marginTop:3}} />
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

function ModernComboRibbonSection({
  sectionInstanceId,
  config,
  items = [],
  onAddCombo,
  interactionState = onAddCombo ? 'enabled' : 'ordering-disabled',
  theme,
}: ComboRibbonSectionProps) {
  const { text, number, bool } = makeReaders(config)
  const groups = resolveComboRibbonGroups(config, items)
  if (groups.length === 0) return null

  const layout = text('layout', 'stack') === 'scroll' ? 'scroll' : 'stack'
  const density = text('density', 'comfortable') === 'compact' ? 'compact' : 'comfortable'
  const showTitle = bool('showTitle', true)
  const showImages = bool('showImages', true)
  const showItemNames = bool('showItemNames', true)
  const showSavings = bool('showSavings', true)
  const sectionBackground = text('bgColor', 'var(--p-bg)')
  const titleColor = text('titleColor', 'var(--p-text)')
  const accentColor = text('accentColor', 'var(--p-accent)')
  const itemSurfaceColor = text('itemBgColor', 'var(--p-bg)')
  const itemTextColor = text('itemTextColor', 'var(--p-text)')
  const priceColor = text('priceColor', 'var(--p-text)')
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const buttonStyle = ctaMode === 'inherit' ? (theme?.cardCtaStyle ?? 'pill') : text('buttonStyle', 'pill')
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', 'var(--p-cta)')
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', 'var(--p-cta-text)')
  const imageSize = number('imageSize', density === 'compact' ? 56 : 68)
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imagePosition = resolveImagePosition(text('imagePosition', 'center'))
  const imageRadius = resolveImageRadius(text('imageShape', 'rounded'))
  const canAdd = interactionState === 'enabled' && Boolean(onAddCombo)

  return (
    <section
      id={`custom-section-${sectionInstanceId}`}
      className={tagShimmerScopeClass(theme)}
      data-component="custom-section"
      data-section-kind="combo-ribbon"
      data-combo-editorial-version="2"
      style={customSectionShell}
    >
      <style>{`
        .garsonless-combo-v2-card { container-type: inline-size; }
        .garsonless-combo-v2-header { display:grid; grid-template-columns:minmax(0,1fr) max-content; align-items:start; gap:12px; }
        .garsonless-combo-v2-price { min-width:0; max-width:100%; text-align:right; font-variant-numeric:tabular-nums; }
        .garsonless-combo-v2-total { overflow-wrap:anywhere; font-size:clamp(14px, 6cqi, 20px); }
        .garsonless-combo-product-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
        .garsonless-combo-product-grid[data-product-count="3"] > :last-child { grid-column:1 / -1; }
        .garsonless-combo-product-item { min-width:0; }
        .garsonless-combo-v2-add { transition:transform 140ms ease, filter 140ms ease, box-shadow 140ms ease; }
        .garsonless-combo-v2-add:not(:disabled):hover { transform:translateY(-1px); filter:brightness(1.04); box-shadow:0 8px 20px -13px currentColor; }
        .garsonless-combo-v2-add:not(:disabled):active { transform:scale(.98); }
        .garsonless-combo-v2-add:focus-visible { outline:2px solid var(--combo-accent); outline-offset:3px; }
        @container (max-width:270px) {
          .garsonless-combo-v2-header { grid-template-columns:minmax(0,1fr); gap:8px; }
          .garsonless-combo-v2-price { text-align:left; }
          .garsonless-combo-product-grid { grid-template-columns:minmax(0,1fr); }
          .garsonless-combo-product-item { align-items:flex-start !important; flex-direction:column; }
          .garsonless-combo-product-media { width:40px !important; height:40px !important; }
          .garsonless-combo-v2-add:not([data-button-style="icon"]) { width:100% !important; min-width:0 !important; margin-left:0 !important; }
          .garsonless-combo-v2-add:not([data-button-style="icon"]) { padding-inline:10px !important; gap:4px !important; font-size:11px !important; white-space:nowrap; }
        }
        @media (prefers-reduced-motion:reduce) {
          .garsonless-combo-v2-add { transition:none !important; }
          .garsonless-combo-v2-add:not(:disabled):hover { transform:none; }
        }
      `}</style>
      <div style={{
        '--combo-accent': accentColor,
        background: sectionBackground,
        border: 'var(--p-border-w) solid var(--p-border)',
        borderRadius: number('radius', 18),
        padding: density === 'compact' ? 12 : 16,
        boxShadow: 'var(--p-shadow)',
      } as CSSProperties}>
        {showTitle ? (
          <div style={{ marginBottom: density === 'compact' ? 10 : 14 }}>
            <h2 style={{ margin: 0, color: titleColor, fontFamily: 'var(--p-body)', fontSize: density === 'compact' ? 19 : 21, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-.02em' }}>
              {text('title', 'Birlikte daha güzel')}
            </h2>
            {config.description?.trim() ? (
              <p style={{ margin: '5px 0 0', color: 'var(--p-text-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                {config.description.trim()}
              </p>
            ) : null}
          </div>
        ) : null}

        <div style={{
          display: layout === 'scroll' ? 'flex' : 'grid',
          gridTemplateColumns: 'minmax(0,1fr)',
          gap: number('cardGap', density === 'compact' ? 10 : 12),
          overflowX: layout === 'scroll' ? 'auto' : 'visible',
          scrollSnapType: layout === 'scroll' ? 'x mandatory' : undefined,
          paddingBottom: layout === 'scroll' ? 4 : 0,
        }}>
          {groups.map((group) => {
            const prefix = `combo${group.index}`
            const cardBackground = text(`${prefix}Color`, 'var(--p-card)')
            const cardTextColor = text(`${prefix}TextColor`, 'var(--p-text)')
            const customTitle = config[`${prefix}Title`]?.trim()
            const cardTitle = customTitle || `${group.items.length} Ürünlük Kombo`
            const badge = config[`${prefix}Badge`]?.trim() || `${group.items.length} ürün`

            return (
              <article
                key={group.id}
                className="garsonless-combo-v2-card"
                data-combo-card={group.index}
                data-combo-ready="true"
                style={{
                  minWidth: layout === 'scroll' ? 'min(84vw, 340px)' : 0,
                  maxWidth: '100%',
                  scrollSnapAlign: layout === 'scroll' ? 'start' : undefined,
                  background: cardBackground,
                  color: cardTextColor,
                  borderRadius: number('cardRadius', 16),
                  padding: density === 'compact' ? 12 : 14,
                  border: 'var(--p-border-w) solid var(--p-border)',
                  display: 'grid',
                  gap: density === 'compact' ? 10 : 12,
                  boxSizing: 'border-box',
                }}
              >
                <header className="garsonless-combo-v2-header">
                  <div style={{ minWidth: 0 }}>
                    <span className={TAG_SHIMMER_TARGET_CLASS} style={{
                      display: 'inline-flex', alignItems: 'center', minHeight: 22, maxWidth: '100%', padding: '3px 8px', borderRadius: 999,
                      background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: text('badgeTextColor', 'var(--p-text)'),
                      fontSize: 10, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{badge}</span>
                    <h3 style={{ margin: '7px 0 0', color: cardTextColor, fontSize: density === 'compact' ? 15 : 17, lineHeight: 1.25, fontWeight: 820, overflowWrap: 'anywhere' }}>
                      {cardTitle}
                    </h3>
                  </div>
                  <div className="garsonless-combo-v2-price">
                    {group.hasSpecialPrice ? <div style={{ color: 'var(--p-text-2)', fontSize: 11, lineHeight: 1.3, textDecoration: 'line-through' }}>{formatTRY(group.catalogTotal)}</div> : null}
                    <strong className="garsonless-combo-v2-total" style={{ display: 'block', color: priceColor, lineHeight: 1.15 }}>
                      {formatTRY(group.total)}
                    </strong>
                    {showSavings && group.savings > 0 ? (
                      <span style={{ display: 'block', marginTop: 3, color: accentColor, fontSize: 10.5, lineHeight: 1.3, fontWeight: 800 }}>
                        {formatTRY(group.savings)} kazanç · %{group.savingsPercent}
                      </span>
                    ) : null}
                  </div>
                </header>

                <ComboProductContents
                  items={group.items}
                  showImages={showImages}
                  showItemNames={showItemNames}
                  imageSize={imageSize}
                  imageFit={imageFit}
                  imagePosition={imagePosition}
                  imageRadius={imageRadius}
                  surfaceColor={itemSurfaceColor}
                  textColor={itemTextColor}
                />

                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--p-text-2)', fontSize: 11, lineHeight: 1.35, fontWeight: 700 }}>
                    {group.items.length} ürün birlikte sepete eklenir
                  </span>
                  <button
                    type="button"
                    className="garsonless-combo-v2-add"
                    data-button-style={buttonStyle}
                    data-cta-source={ctaMode}
                    data-cta-icon={buttonIcon}
                    disabled={!canAdd}
                    aria-label={`${cardTitle} ürünlerini sepete ekle`}
                    onClick={() => {
                      if (!canAdd) return
                      onAddCombo?.({ sectionInstanceId, comboIndex: group.index, title: cardTitle, items: group.items, catalogTotal: group.catalogTotal, total: group.total })
                    }}
                    style={{
                      width: buttonStyle === 'full' ? '100%' : buttonStyle === 'icon' ? buttonSize : 'auto',
                      maxWidth: '100%', minWidth: buttonStyle === 'icon' ? buttonSize : 0, minHeight: buttonSize,
                      marginLeft: buttonStyle === 'full' ? 0 : 'auto', padding: buttonStyle === 'icon' ? 0 : `10px ${Math.round(buttonSize * .38)}px`,
                      border: 0, borderRadius: buttonStyle === 'full' ? 12 : 999, background: buttonBackground, color: buttonColor,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      fontFamily: 'var(--p-body)', fontSize: 12, lineHeight: 1.2, fontWeight: 850,
                      cursor: canAdd ? 'pointer' : 'not-allowed', opacity: canAdd ? 1 : .58, overflowWrap: 'anywhere',
                    }}
                  >
                    <ComboCtaIcon kind={buttonIcon} size={Math.max(17, Math.round(buttonSize * .4))} />
                    {buttonStyle !== 'icon' ? <span>{text('ctaText', 'Komboyu ekle')}</span> : null}
                  </button>
                </div>
                {group.requiresConfiguration ? (
                  <p role="status" style={{ margin: '-4px 0 0', color: 'var(--p-text-2)', fontSize: 11, lineHeight: 1.4 }}>
                    Seçenekleri sonraki adımda tamamlayabilirsiniz.
                  </p>
                ) : null}
                {!canAdd && interactionState !== 'preview' ? (
                  <p style={{ margin: '-4px 0 0', color: 'var(--p-text-2)', fontSize: 11, lineHeight: 1.4 }}>
                    Sipariş şu anda kapalı.
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ComboProductContents({
  items,
  showImages,
  showItemNames,
  imageSize,
  imageFit,
  imagePosition,
  imageRadius,
  surfaceColor,
  textColor,
}: {
  items: MenuItem[]
  showImages: boolean
  showItemNames: boolean
  imageSize: number
  imageFit: 'cover' | 'contain'
  imagePosition: string
  imageRadius: number
  surfaceColor: string
  textColor: string
}) {
  return (
    <div aria-label={`Kombo içeriği: ${items.length} ürün birlikte`} style={{ display: 'grid', gap: 7, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ color: textColor, fontSize: 11.5, lineHeight: 1.3, fontWeight: 820 }}>Kombo içeriği</strong>
        <span style={{ color: 'var(--p-text-2)', fontSize: 10.5, lineHeight: 1.3, fontWeight: 700 }}>{items.length} ürün dahil</span>
      </div>
      <div className="garsonless-combo-product-grid" data-product-count={items.length} role="list">
        {items.map((item) => (
          <div
            key={item.id}
            className="garsonless-combo-product-item"
            role="listitem"
            style={{
              minHeight: 62, padding: 7, borderRadius: 11, border: '1px solid var(--p-border)',
              background: surfaceColor, color: textColor, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
            }}
          >
            {showImages ? <ProductImage item={item} size={Math.min(imageSize, 56)} fit={imageFit} position={imagePosition} radius={imageRadius} className="garsonless-combo-product-media" /> : null}
            <div style={{ minWidth: 0 }}>
              {showItemNames ? (
                <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere', fontSize: 12, lineHeight: 1.25, fontWeight: 800 }}>
                  {item.name}
                </div>
              ) : null}
              {item.description?.trim() ? (
                <p style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, margin: '2px 0 0', overflow: 'hidden', color: 'var(--p-text-2)', fontSize: 10, lineHeight: 1.3 }}>
                  {item.description.trim()}
                </p>
              ) : null}
              <ProductAllergenSummary item={item} maxVisible={2} style={{ marginTop: 3 }} />
              <div style={{ marginTop: 3, color: 'var(--p-text-2)', fontSize: 10.5, fontWeight: 780 }}>{formatTRY(item.price)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductImage({ item, size, fit, position, radius, className }: { item: MenuItem; size: number; fit: 'cover' | 'contain'; position: string; radius: number; className?: string }) {
  return (
    <span className={className} style={{ width: size, height: size, flexShrink: 0, borderRadius: radius, overflow: 'hidden', background: 'color-mix(in srgb, var(--p-border) 45%, transparent)', display: 'grid', placeItems: 'center' }}>
      {item.images[0] ? (
        <img src={item.images[0]} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: position, display: 'block' }} />
      ) : (
        <AppIcons.image size={18} aria-hidden="true" />
      )}
    </span>
  )
}

function resolveImagePosition(value: string) {
  const positions: Record<string, string> = {
    center: 'center center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center',
    'top-left': 'left top', 'top-right': 'right top', 'bottom-left': 'left bottom', 'bottom-right': 'right bottom',
  }
  return positions[value] ?? positions.center!
}

function resolveImageRadius(value: string) {
  if (value === 'circle') return 999
  if (value === 'square') return 0
  return 10
}

function ComboCtaIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === 'cart') return <AppIcons.cart size={size} />
  if (kind === 'bag') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  return <AppIcons.plus size={size} />
}
