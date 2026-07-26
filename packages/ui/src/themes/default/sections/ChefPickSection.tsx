import React from 'react'
import type { CSSProperties } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { AppIcons } from '../../../icons'
import { formatTRY } from '../../../menu/formatCurrency'
import type { MenuItem } from '../../../menu/types'
import { customSectionShell, makeReaders } from '../lib/sectionHelpers'
import { resolveChefPickItems } from './chefPickModel'
import { ChefSectionIcon, isChefSectionIconName } from './ChefSectionIcon'

type ChefPickTheme = Pick<GarsonlessTheme, 'cardCtaStyle' | 'cardCtaIcon' | 'cta' | 'ctaTextColor'>

const ICON_SIZE = { small: 18, medium: 24, large: 30 } as const
const BUTTON_SIZE = { small: 34, medium: 40, large: 46 } as const

export function ChefPickSection({
  config,
  items = [],
  onQuickAdd,
  theme,
}: {
  config: Record<string, string>
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
  theme?: ChefPickTheme
}) {
  const { text, number, bool } = makeReaders(config)
  const selectedItems = resolveChefPickItems(config, items)
  const layout = text('layout', 'list') === 'grid' ? 'grid' : 'list'
  const density = text('density', 'comfortable') === 'compact' ? 'compact' : 'comfortable'
  const showImages = bool('showImages', true)
  const showDescription = bool('showProductDescription', false)
  const imageShape = text('imageShape', 'rounded')
  const surfaceColor = text('bgColor', '#1a1612')
  const accentColor = text('accentColor', '#ffd089')
  const textColor = text('textColor', '#ffffff')
  const chefIconChoice = text('chefIcon', 'catal-kasik')
  const chefIconName = isChefSectionIconName(chefIconChoice) ? chefIconChoice : 'catal-kasik'
  const chefIconSizeName = text('chefIconSize', 'medium') as keyof typeof ICON_SIZE
  const chefIconSize = ICON_SIZE[chefIconSizeName] ?? ICON_SIZE.medium
  const chefIconUrl = text('chefIconUrl', '')
  const customChefIcon = chefIconChoice === 'custom' && chefIconUrl.length > 0
  const ctaMode = text('ctaMode', 'inherit') === 'custom' ? 'custom' : 'inherit'
  const inheritedButtonStyle = theme?.cardCtaStyle ?? 'icon'
  const buttonStyle = ctaMode === 'inherit' ? inheritedButtonStyle : text('buttonStyle', 'icon')
  const buttonIcon = ctaMode === 'inherit' ? (theme?.cardCtaIcon ?? 'plus') : text('buttonIcon', 'plus')
  const buttonIconUrl = text('buttonIconUrl', '')
  const buttonSizeName = text('buttonSize', 'medium') as keyof typeof BUTTON_SIZE
  const buttonSize = BUTTON_SIZE[buttonSizeName] ?? BUTTON_SIZE.medium
  const buttonBackground = ctaMode === 'inherit' ? 'var(--p-cta)' : text('buttonBgColor', accentColor)
  const buttonColor = ctaMode === 'inherit' ? 'var(--p-cta-text)' : text('buttonTextColor', surfaceColor)
  const outerRadius = number('radius', 18)
  const itemRadius = number('itemRadius', 12)
  const itemGap = number('itemGap', 8)
  const imageSize = number('imageSize', density === 'compact' ? 42 : 50)
  const ctaText = text('ctaText', 'Ekle')
  const showEyebrow = bool('showEyebrow', true)
  const showTitle = bool('showTitle', true)
  const showBody = bool('showBody', true)
  const showQuote = bool('showQuote', true)
  const itemBackground = text('itemBgColor', `color-mix(in srgb, ${textColor} 5%, transparent)`)
  const itemBorderColor = text('itemBorderColor', `color-mix(in srgb, ${textColor} 9%, transparent)`)
  const itemTextColor = text('itemTextColor', textColor)
  const itemMutedColor = text('itemMutedColor', textColor)
  const priceColor = text('priceColor', accentColor)
  const imageBackground = text('imageBgColor', `color-mix(in srgb, ${accentColor} 12%, transparent)`)

  const imageRadius = imageShape === 'circle' ? 999 : imageShape === 'square' ? 4 : Math.min(itemRadius, 12)
  const itemPadding = density === 'compact' ? 8 : 10

  if (selectedItems.length === 0 && onQuickAdd) return null

  return (
    <section data-component="custom-section" data-section-kind="chef-pick" style={customSectionShell}>
      <style>{`
        .garsonless-chef-pick-item {
          transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
        }
        .garsonless-chef-pick-item:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--chef-accent) 32%, transparent) !important;
          background: color-mix(in srgb, var(--chef-item-bg) 92%, var(--chef-accent) 8%) !important;
        }
        .garsonless-chef-pick-add {
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
        }
        .garsonless-chef-pick-add:not(:disabled):hover {
          transform: translateY(-1px) scale(1.03);
          filter: brightness(1.04);
          box-shadow: 0 7px 18px -10px var(--chef-accent);
        }
        .garsonless-chef-pick-add:not(:disabled):active { transform: scale(.97); }
        .garsonless-chef-pick-add:focus-visible {
          outline: 2px solid var(--chef-accent);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-chef-pick-item, .garsonless-chef-pick-add { transition: none !important; }
          .garsonless-chef-pick-item:hover, .garsonless-chef-pick-add:not(:disabled):hover { transform: none; }
        }
      `}</style>
      <div style={{
        '--chef-accent': accentColor,
        '--chef-cta': buttonBackground,
        '--chef-item-bg': itemBackground,
        borderRadius: outerRadius,
        background: surfaceColor,
        color: textColor,
        padding: density === 'compact' ? 13 : 16,
        overflow: 'hidden',
        boxShadow: 'var(--p-shadow)',
      } as CSSProperties}>
        {(showEyebrow || showTitle || showBody) && (
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: density === 'compact' ? 11 : 16 }}>
            <div aria-hidden data-chef-icon={customChefIcon ? 'custom' : chefIconName} style={{
              width: Math.max(density === 'compact' ? 42 : 52, chefIconSize + 22),
              height: Math.max(density === 'compact' ? 42 : 52, chefIconSize + 22),
              borderRadius: 999,
              background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
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
            <div style={{ flex: 1, minWidth: 0 }}>
              {showEyebrow && (
                <div style={{ fontSize: 10, color: accentColor, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase' }}>
                  {text('eyebrow', "ŞEF'İN SEÇİMİ")}
                </div>
              )}
              {showTitle && (
                <div style={{ fontFamily: 'var(--p-display)', fontSize: density === 'compact' ? 19 : 22, fontWeight: 700, color: textColor, marginTop: showEyebrow ? 2 : 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {text('title', 'İmza tabaklar')}
                </div>
              )}
              {showBody && (
                <div style={{ fontSize: 11.5, color: textColor, opacity: .62, marginTop: 2, lineHeight: 1.4 }}>
                  {text('body', 'Mutfağın öne çıkan lezzetleri')}
                </div>
              )}
            </div>
          </header>
        )}

        {selectedItems.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: layout === 'grid' ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            gap: itemGap,
          }}>
            {selectedItems.map((item) => (
              <article
                key={item.id}
                className="garsonless-chef-pick-item"
                data-chef-pick-item={item.id}
                style={{
                  display: 'flex',
                  flexDirection: layout === 'grid' ? 'column' : 'row',
                  alignItems: layout === 'grid' ? 'stretch' : 'center',
                  gap: layout === 'grid' ? 9 : 11,
                  background: itemBackground,
                  border: `1px solid ${itemBorderColor}`,
                  borderRadius: itemRadius,
                  padding: itemPadding,
                  minWidth: 0,
                }}
              >
                {showImages && (
                  <div style={{
                    width: layout === 'grid' ? '100%' : imageSize,
                    height: layout === 'grid' ? Math.max(82, imageSize * 1.65) : imageSize,
                    borderRadius: imageRadius,
                    background: imageBackground,
                    color: accentColor,
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <AppIcons.image size={20} aria-hidden="true" />
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: layout === 'grid' ? 13 : 14, lineHeight: 1.3, fontWeight: 750, color: itemTextColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </h3>
                    {showDescription && item.description && (
                      <p style={{ margin: '3px 0 0', color: itemMutedColor, fontSize: 10.5, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{ color: priceColor, fontSize: 13, fontWeight: 800, marginTop: showDescription ? 5 : 3 }}>
                      {formatTRY(item.price)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="garsonless-chef-pick-add"
                    data-cta-source={ctaMode}
                    data-cta-icon={buttonIcon}
                    disabled={!onQuickAdd}
                    aria-label={`${item.name} sepete ekle`}
                    onClick={() => onQuickAdd?.(item)}
                    style={{
                      minWidth: buttonStyle === 'icon' ? buttonSize : buttonStyle === 'full' ? Math.max(88, buttonSize * 2.2) : Math.max(66, buttonSize * 1.7),
                      height: buttonSize,
                      padding: buttonStyle === 'icon' ? 0 : `0 ${Math.round(buttonSize * .35)}px`,
                      borderRadius: 999,
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
                    }}
                  >
                    <ChefPickCtaIcon kind={buttonIcon} customUrl={buttonIconUrl} size={Math.max(15, Math.round(buttonSize * .42))} />
                    {buttonStyle !== 'icon' && <span>{ctaText}</span>}
                  </button>
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
            color: textColor,
            opacity: .62,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            Şefin seçimi için yayınlanan ürünlerden seçim yapın.
          </div>
        )}

        {showQuote && (
          <footer style={{ textAlign: 'center', marginTop: density === 'compact' ? 10 : 14, fontSize: 11.5, color: textColor, opacity: .42, fontStyle: 'italic', fontFamily: 'var(--p-display)' }}>
            “{text('quote', 'Her tabak, bir hikâye anlatır.')}”
          </footer>
        )}
      </div>
    </section>
  )
}

function ChefPickCtaIcon({ kind, customUrl, size }: { kind: string; customUrl: string; size: number }) {
  if (kind === 'custom' && customUrl) {
    return <img src={customUrl} alt="" aria-hidden style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
  }
  if (kind === 'cart') return <AppIcons.cart size={size} />
  if (kind === 'bag') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  }
  return <AppIcons.plus size={size} />
}
