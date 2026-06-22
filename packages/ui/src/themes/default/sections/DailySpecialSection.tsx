import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MenuItem } from '../../../menu/types'
import { formatTRY } from '../../../menu/formatCurrency'
import { makeReaders, customSectionShell, parseCountdownTarget } from '../lib/sectionHelpers'
import type { DailySpecialConfig } from '../lib/sectionTypes'

function DailySpecialOuter({
  config,
  product,
  onQuickAdd,
  sectionStyle,
}: {
  config: DailySpecialConfig
  product: MenuItem | null
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
  sectionStyle: CSSProperties
}) {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const target = parseCountdownTarget(config.timerValue)
    if (!target) return
    const tick = () => { if (target.getTime() - Date.now() <= 0) setExpired(true) }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [config.timerValue])

  if (expired) return null

  return (
    <section data-component="custom-section" style={sectionStyle}>
      <div style={{ borderRadius: config.radius, background: config.bgColor, padding: 16 }}>
        <DailySpecialSection
          config={config}
          product={product}
          {...(onQuickAdd ? { onQuickAdd } : {})}
        />
      </div>
    </section>
  )
}

function DailySpecialSection({
  config,
  product,
  onQuickAdd,
}: {
  config: DailySpecialConfig
  product: MenuItem | null
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
}) {
  const isRealCountdown = Boolean(parseCountdownTarget(config.timerValue))
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null)

  useEffect(() => {
    const target = parseCountdownTarget(config.timerValue)
    if (!target) { setTimeLeft(null); return }
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0 }); return }
      setTimeLeft({
        h: Math.floor(diff / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
      })
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [config.timerValue])

  function handleAddToCart() {
    if (!product || !onQuickAdd) return
    const hasDiscount = config.priceOverride !== null && config.priceOverride !== product.price
    const effectiveItem: MenuItem = hasDiscount
      ? { ...product, price: config.priceOverride! }
      : product
    onQuickAdd(effectiveItem, hasDiscount ? product.price : undefined)
  }

  const showTimer = Boolean(config.timerValue)
  const expired = isRealCountdown && timeLeft !== null && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0

  if (expired) return null

  return (
    <>
      <style>{`
        @keyframes ds-corner-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes ds-colon-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes ds-live-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
      `}</style>

      <div style={{
        borderRadius: config.radius,
        overflow: 'hidden',
        position: 'relative',
        border: `1.5px solid ${config.accentColor}`,
        background: 'var(--p-card)',
        boxShadow: 'var(--p-shadow)',
      }}>
        {/* Hero image */}
        <div style={{
          height: 160,
          position: 'relative',
          background: config.heroImage
            ? `url("${config.heroImage}") center/cover`
            : `linear-gradient(135deg, ${config.bgStart}, ${config.bgEnd})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 64,
          overflow: 'hidden',
        }}>
          {!config.heroImage && '🍽'}

          {/* Corner ribbon (çentik) */}
          {(() => {
            const sizes = {
              sm: { n: 90,  w: 110, top: 22, tlLeft: -25, trLeft: 5,  fs: 8,  pad: '4px 0' },
              md: { n: 110, w: 138, top: 27, tlLeft: -32, trLeft: 4,  fs: 10, pad: '5px 0' },
              lg: { n: 130, w: 165, top: 32, tlLeft: -39, trLeft: 5,  fs: 12, pad: '7px 0' },
            }
            const sz = sizes[config.ribbonSize] ?? sizes.md
            const isTR = config.ribbonCorner === 'tr'
            const containerPos = isTR ? { top: 0 as const, right: 0 as const } : { top: 0 as const, left: 0 as const }
            return (
              <div style={{
                position: 'absolute', ...containerPos,
                width: sz.n, height: sz.n,
                overflow: 'hidden',
                zIndex: 3,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute',
                  top: sz.top,
                  left: isTR ? sz.trLeft : sz.tlLeft,
                  width: sz.w,
                  overflow: 'hidden',
                  background: config.accentColor,
                  transform: `rotate(${isTR ? 45 : -45}deg)`,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}>
                  <div style={{
                    display: 'flex',
                    width: 'max-content',
                    animation: `ds-corner-scroll ${config.ribbonSpeed}s linear infinite`,
                    padding: sz.pad,
                  }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} style={{
                        color: '#fff',
                        fontSize: sz.fs,
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        padding: '0 10px',
                      }}>
                        {config.eyebrow || 'GÜNÜN ÖZELİ'}&nbsp;✦
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Countdown badge — Fix 2 */}
          {showTimer && (
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              background: config.timerBg,
              backdropFilter: 'blur(8px)',
              borderRadius: 10,
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {/* Live pulse dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#ff4444', flexShrink: 0,
                animation: 'ds-live-pulse 1.5s ease-in-out infinite',
              }} />
              {isRealCountdown && timeLeft ? (
                /* HH:MM:SS boxes */
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {([
                    { value: String(timeLeft.h).padStart(2, '0'), label: 'SA' },
                    { value: String(timeLeft.m).padStart(2, '0'), label: 'DK' },
                    { value: String(timeLeft.s).padStart(2, '0'), label: 'SN' },
                  ] as const).map((unit, i) => (
                    <span key={unit.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {i > 0 && (
                        <span style={{
                          color: config.timerColor, fontSize: 16, fontWeight: 700, opacity: 0.6,
                          lineHeight: 1, margin: '0 2px',
                          animation: 'ds-colon-pulse 1s ease-in-out infinite',
                        }}>:</span>
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 26 }}>
                        <span style={{
                          color: config.timerColor, fontSize: 18, fontWeight: 700, lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace',
                        }}>{unit.value}</span>
                        <span style={{
                          color: config.timerColor, fontSize: 8, opacity: 0.55,
                          letterSpacing: '0.1em', marginTop: 1,
                        }}>{unit.label}</span>
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                /* Plain text */
                <span style={{ color: config.timerColor, fontSize: 12, fontWeight: 600 }}>
                  {config.timerValue}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 18 }}>
          <div style={{
            fontFamily: 'var(--p-display)',
            fontSize: 26, color: config.accentColor, lineHeight: 1.1, fontWeight: 700,
          }}>
            {config.title}
          </div>
          {config.body && (
            <div style={{ fontSize: 12.5, color: 'var(--p-text-2)', marginTop: 6, lineHeight: 1.5 }}>
              {config.body}
            </div>
          )}
          {config.chefNote && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 12, padding: '8px 10px',
              background: 'var(--p-accent-soft)', borderRadius: 10,
            }}>
              <span style={{ fontSize: 18 }}>👨‍🍳</span>
              <span style={{ fontSize: 11.5, color: config.accentColor, fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif' }}>
                {config.chefNote}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 850, color: 'var(--p-text)' }}>{config.displayPrice}</span>
              {config.oldPrice && (
                <span style={{ fontSize: 13, color: 'var(--p-text-2)', textDecoration: 'line-through' }}>
                  {config.oldPrice.startsWith('₺') ? config.oldPrice : `₺${config.oldPrice}`}
                </span>
              )}
            </div>
            {product && onQuickAdd ? (
              <button
                type="button"
                onClick={handleAddToCart}
                style={{
                  background: config.accentColor, color: '#fff', border: 'none',
                  borderRadius: 99, padding: '11px 22px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--p-body)',
                }}
              >
                {config.ctaText}
              </button>
            ) : (
              <a href="#" style={{
                background: config.accentColor, color: '#fff',
                borderRadius: 99, padding: '11px 22px',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                {config.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function DailySpecialBlock({
  config,
  items,
  onQuickAdd,
}: {
  config: Record<string, string>
  items?: MenuItem[] | undefined
  onQuickAdd?: (item: MenuItem, originalPrice?: number) => void
}) {
  const { text, number } = makeReaders(config)
  const productId = text('productId', '')
  const product = productId ? (items ?? []).find((item) => item.id === productId) ?? null : null
  const priceRaw = text('price', '')
  const priceOverride = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : null
  const displayPrice = priceRaw
    ? (priceRaw.startsWith('₺') ? priceRaw : `₺${priceRaw}`)
    : product ? formatTRY(product.price) : '₺0'

  const cfg: DailySpecialConfig = {
    heroImage: text('imageUrl', '') || (product?.images[0] ?? ''),
    title: text('title', '') || product?.name || 'Günün Özeli',
    body: text('body', '') || product?.description || '',
    displayPrice,
    priceOverride: Number.isFinite(priceOverride) ? priceOverride : null,
    oldPrice: text('oldPrice', ''),
    accentColor: text('accentColor', 'var(--p-accent)'),
    chefNote: text('chefNote', ''),
    timerValue: text('timer', ''),
    timerBg: text('timerBg', 'rgba(0,0,0,0.75)'),
    timerColor: text('timerColor', '#ffffff'),
    ctaText: text('cta', 'Sepete ekle'),
    eyebrow: text('eyebrow', 'GÜNÜN ÖZELİ'),
    bgStart: text('bgStart', 'var(--p-accent-soft)'),
    bgEnd: text('bgEnd', 'var(--p-cta)'),
    bgColor: text('bgColor', 'var(--p-card)'),
    radius: number('radius', 18),
    ribbonCorner: (text('ribbonCorner', 'tl') || 'tl') as 'tl' | 'tr',
    ribbonSize: (text('ribbonSize', 'md') || 'md') as 'sm' | 'md' | 'lg',
    ribbonSpeed: number('ribbonSpeed', 8),
  }

  return (
    <DailySpecialOuter
      config={cfg}
      product={product ?? null}
      sectionStyle={customSectionShell}
      {...(onQuickAdd ? { onQuickAdd } : {})}
    />
  )
}
