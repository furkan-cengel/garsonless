'use client'

import { useMenuLocale } from '../../../menu/MenuLocaleContext'
import { useMenuReaders } from '../../../menu/MenuLocaleContext'
import React from 'react'
import type { CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem } from '../../../menu/types'
import { ProductAllergenSummary } from '../../../menu/FoodInfoBadges'
import { customSectionShell } from '../lib/sectionHelpers'
import { resolveChefPickItems } from './chefPickModel'
import { ChefSectionIcon, isChefSectionIconName } from './ChefSectionIcon'

type ChefPickTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const ICON_SIZE = { small: 17, medium: 20, large: 23 } as const
const BUTTON_SIZE = { small: 40, medium: 44, large: 48 } as const

export function ChefPickSection({
  config,
  items = [],
  onQuickAdd,
  theme,
  actionMode = 'order',
  sectionInstanceId = 'chef-pick',
  editorPreview = false,
}: {
  config: Record<string, string>
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
  theme?: ChefPickTheme
  actionMode?: 'order' | 'discover'
  sectionInstanceId?: string
  editorPreview?: boolean
}) {
  const { t } = useMenuLocale();
  const { text, number, bool } = useMenuReaders(config)
  const selectedItems = resolveChefPickItems(config, items)
  const density = text('density', 'comfortable') === 'compact' ? 'compact' : 'comfortable'
  const showImages = bool('showImages', true)
  const showDescription = bool('showProductDescription', false)
  const imageShape = text('imageShape', 'rounded')
  const imageFit = text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'
  const imageFocusValue = text('imagePosition', 'center')
  const imageFocus = imageFocusValue === 'top' || imageFocusValue === 'bottom' ? imageFocusValue : 'center'
  const imagePosition = `center ${imageFocus}`
  const modernEditorial = text('editorialVersion', '') === '2'
  const surfaceColor = text('bgColor', modernEditorial ? 'var(--p-card)' : '#1a1612')
  const accentColor = text('accentColor', modernEditorial ? 'var(--p-accent)' : '#ffd089')
  const textColor = text('textColor', modernEditorial ? 'var(--p-text)' : '#ffffff')
  const chefIconChoice = text('chefIcon', 'catal-kasik')
  const chefIconName = isChefSectionIconName(chefIconChoice) ? chefIconChoice : 'catal-kasik'
  const chefIconSizeName = text('chefIconSize', 'medium') as keyof typeof ICON_SIZE
  const chefIconSize = ICON_SIZE[chefIconSizeName] ?? ICON_SIZE.medium
  const chefIconUrl = text('chefIconUrl', '')
  const customChefIcon = chefIconChoice === 'custom' && chefIconUrl.length > 0
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const inheritedButtonStyle = theme?.cardCtaStyle ?? 'icon'
  const buttonStyleValue = ctaMode === 'inherit' ? inheritedButtonStyle : text('buttonStyle', 'icon')
  const buttonStyle = buttonStyleValue === 'full' || buttonStyleValue === 'pill' ? buttonStyleValue : 'icon'
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonIconUrl = text('buttonIconUrl', '')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', accentColor)
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', surfaceColor)
  const outerRadius = number('radius', 18)
  const itemRadius = number('itemRadius', 12)
  const itemGap = number('itemGap', 10)
  const storedImageSize = number('imageSize', density === 'compact' ? 78 : 88)
  const imageSize = Math.min(112, Math.max(72, storedImageSize))
  const ctaText = actionMode === 'discover' ? t("İncele") : t("Ekle")
  const showEyebrow = bool('showEyebrow', true)
  const showTitle = bool('showTitle', true)
  const showBody = bool('showBody', true)
  const showQuote = bool('showQuote', true)
  const itemBackground = text('itemBgColor', modernEditorial ? 'var(--p-card)' : '#241f1a')
  const itemBorderColor = text('itemBorderColor', modernEditorial ? 'var(--p-border)' : '#3b342d')
  const itemTextColor = text('itemTextColor', modernEditorial ? 'var(--p-text)' : '#ffffff')
  const itemMutedColor = text('itemMutedColor', modernEditorial ? 'var(--p-text-2)' : '#b9b2ab')
  const priceColor = text('priceColor', modernEditorial ? 'var(--p-text)' : '#ffd089')
  const imageBackground = text('imageBgColor', modernEditorial ? 'var(--p-card)' : '#3a3024')
  const imageRadius = imageShape === 'circle' ? '50%' : imageShape === 'square' ? 4 : Math.min(itemRadius, 14)
  const itemPadding = density === 'compact' ? 9 : 11
  const safeInstanceId = sectionInstanceId.replace(/[^a-zA-Z0-9_-]/g, '-')
  const headingId = `${safeInstanceId}-title`
  const fallbackLabel = text('eyebrow', "Şef'in Seçimi")

  if (selectedItems.length === 0 && !editorPreview) return null

  return (
    <section
      data-component="custom-section"
      data-section-kind="chef-pick"
      aria-labelledby={showTitle ? headingId : undefined}
      aria-label={showTitle ? undefined : fallbackLabel}
      style={customSectionShell}
    >
      <style>{`
        .garsonless-chef-pick-add {
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
        }
        .garsonless-chef-pick-add:not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow: 0 7px 18px -11px var(--chef-accent);
        }
        .garsonless-chef-pick-add:not(:disabled):active { transform: scale(.98); }
        .garsonless-chef-pick-add:focus-visible {
          outline: 2px solid var(--chef-accent);
          outline-offset: 3px;
        }
        @container (max-width: 250px) {
          .garsonless-chef-pick-header {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .garsonless-chef-pick-item {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .garsonless-chef-pick-media {
            width: 72px !important;
            height: 72px !important;
            justify-self: start;
          }
          .garsonless-chef-pick-add[data-button-style="pill"] {
            width: 40px !important;
            min-width: 40px !important;
            padding-inline: 0 !important;
          }
          .garsonless-chef-pick-add[data-button-style="pill"] .garsonless-chef-pick-cta-text {
            display: none;
          }
          .garsonless-chef-pick-add[data-button-style="full"] {
            padding-inline: 6px !important;
          }
          .garsonless-chef-pick-add[data-button-style="full"] svg,
          .garsonless-chef-pick-add[data-button-style="full"] img {
            display: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-chef-pick-add { transition: none !important; }
          .garsonless-chef-pick-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div style={{
        '--chef-accent': accentColor,
        '--chef-cta': buttonBackground,
        '--chef-item-bg': itemBackground,
        borderRadius: outerRadius,
        background: surfaceColor,
        color: textColor,
        padding: density === 'compact' ? 13 : 15,
        overflow: 'hidden',
        boxShadow: 'var(--p-shadow)',
        containerType: 'inline-size',
      } as CSSProperties}>
        {(showEyebrow || showTitle || showBody || showQuote) && (
          <header className="garsonless-chef-pick-header" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'start', gap: 11, marginBottom: density === 'compact' ? 10 : 13 }}>
            <div aria-hidden data-chef-icon={customChefIcon ? 'custom' : chefIconName} style={{
              width: density === 'compact' ? 36 : 40,
              height: density === 'compact' ? 36 : 40,
              borderRadius: 12,
              background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
              color: accentColor,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              {customChefIcon ? (
                <img src={chefIconUrl} alt="" style={{ width: chefIconSize, height: chefIconSize, objectFit: 'contain', display: 'block' }} />
              ) : (
                <ChefSectionIcon name={chefIconName} width={chefIconSize} height={chefIconSize} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              {showEyebrow && (
                <div style={{ fontSize: 10, lineHeight: 1.25, color: accentColor, fontWeight: 800, letterSpacing: '.11em', textTransform: 'uppercase' }}>
                  {text('eyebrow', "ŞEF'İN SEÇİMİ")}
                </div>
              )}
              {showTitle && (
                <h2 id={headingId} style={{ margin: showEyebrow ? '2px 0 0' : 0, fontFamily: 'var(--p-body)', fontSize: density === 'compact' ? 20 : 21, lineHeight: 1.2, fontWeight: 800, color: textColor, overflowWrap: 'anywhere' }}>
                  {text('title', t("İmza tabaklar"))}
                </h2>
              )}
              {showBody && (
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: itemMutedColor, lineHeight: 1.4 }}>
                  {text('body', t("Mutfağın öne çıkan lezzetleri"))}
                </p>
              )}
              {showQuote && (
                <p data-chef-note style={{ margin: '6px 0 0', paddingLeft: 8, borderLeft: `2px solid ${accentColor}`, fontSize: 11.5, lineHeight: 1.4, color: itemMutedColor, fontStyle: 'italic' }}>
                  “{text('quote', t("Her tabak, bir hikâye anlatır."))}”
                </p>
              )}
            </div>
          </header>
        )}

        {selectedItems.length > 0 ? (
          <div data-chef-pick-list style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: itemGap, containerType: 'inline-size' }}>
            {selectedItems.map((item) => (
              <article
                key={item.id}
                className="garsonless-chef-pick-item"
                data-chef-pick-item={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: showImages ? `${imageSize}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
                  alignItems: 'stretch',
                  gap: density === 'compact' ? 10 : 12,
                  background: itemBackground,
                  border: `1px solid ${itemBorderColor}`,
                  borderRadius: itemRadius,
                  padding: itemPadding,
                  minWidth: 0,
                }}
              >
                {showImages && (
                  <div className="garsonless-chef-pick-media" style={{
                    width: imageSize,
                    height: imageSize,
                    aspectRatio: '1 / 1',
                    borderRadius: imageRadius,
                    background: imageBackground,
                    color: itemMutedColor,
                    display: 'grid',
                    placeItems: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {item.images[0] ? (
                      <img
                        src={item.images[0]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        data-image-fit={imageFit}
                        data-image-position={imageFocus}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: imageFit,
                          objectPosition: imagePosition,
                          display: 'block',
                          transform: imageFit === 'cover' ? 'scale(1.06)' : undefined,
                          transformOrigin: imagePosition,
                        }}
                      />
                    ) : (
                      <AppIcons.image size={19} aria-hidden="true" />
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.3, fontWeight: 750, color: itemTextColor, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                    {item.name}
                  </h3>
                  {showDescription && item.description && (
                    <p style={{ margin: '3px 0 0', color: itemMutedColor, fontSize: 10.5, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description}
                    </p>
                  )}
                  <ProductAllergenSummary item={item} style={{ marginTop: 4 }} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 7 }}>
                    <div style={{ color: priceColor, fontSize: 13.5, lineHeight: 1.2, fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {formatTRY(item.price)}
                    </div>
                    <button
                      type="button"
                      className="garsonless-chef-pick-add"
                      data-cta-source={ctaMode}
                      data-cta-icon={buttonIcon}
                      data-button-style={buttonStyle}
                      disabled={!onQuickAdd}
                      aria-label={`${item.name} ${actionMode === 'discover' ? 'ürününü incele' : 'sepete ekle'}`}
                      onClick={() => onQuickAdd?.(item)}
                      style={{
                        minWidth: buttonStyle === 'icon' ? buttonSize : buttonStyle === 'full' ? '100%' : Math.max(78, buttonSize * 1.8),
                        width: buttonStyle === 'full' ? '100%' : undefined,
                        height: buttonSize,
                        padding: buttonStyle === 'icon' ? 0 : `0 ${Math.round(buttonSize * .34)}px`,
                        borderRadius: buttonStyle === 'full' ? Math.min(14, buttonSize / 2) : 999,
                        border: 'none',
                        background: buttonBackground,
                        color: buttonColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontFamily: 'var(--p-body)',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: onQuickAdd ? 'pointer' : 'default',
                        opacity: onQuickAdd ? 1 : .62,
                        flexShrink: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <ChefPickCtaIcon kind={buttonIcon} customUrl={buttonIconUrl} size={Math.max(16, Math.round(buttonSize * .4))} />
                      {buttonStyle !== 'icon' && <span className="garsonless-chef-pick-cta-text">{ctaText}</span>}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div data-chef-pick-empty style={{
            border: '1px dashed color-mix(in srgb, currentColor 18%, transparent)',
            borderRadius: itemRadius,
            padding: 18,
            textAlign: 'center',
            color: itemMutedColor,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            Şef’in Seçimi için 1-4 aktif ürün seçin.
          </div>
        )}
      </div>
    </section>
  )
}

function ChefPickCtaIcon({ kind, customUrl, size }: { kind: string; customUrl: string; size: number }) {
  if (kind === 'arrow') return <AppIcons.arrow size={size} />
  if (kind === 'custom' && customUrl) {
    return <img src={customUrl} alt="" aria-hidden style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
  }
  if (kind === 'cart') return <AppIcons.cart size={size} />
  if (kind === 'bag') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  return <AppIcons.plus size={size} />
}
