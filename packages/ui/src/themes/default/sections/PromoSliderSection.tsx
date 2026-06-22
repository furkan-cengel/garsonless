import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { makeReaders, customSectionShell, parseCountdownTarget } from '../lib/sectionHelpers'
import type {
  PromoCouponConfig,
  PromoFlashConfig,
  PromoFreebieConfig,
  PromoLoyaltyConfig,
  PromoComboConfig,
  PromoSliderConfig,
} from '../lib/sectionTypes'

const promoSlideBase: CSSProperties = {
  position: 'relative',
  minWidth: '100%',
  height: 150,
  overflow: 'hidden',
  display: 'flex',
  scrollSnapAlign: 'center',
}

function PromoNotch({ side, bg }: { side: 'left' | 'right'; bg: string }) {
  return (
    <div style={{
      position: 'absolute',
      [side]: -8,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 16,
      height: 16,
      borderRadius: 99,
      background: bg,
      zIndex: 1,
    }} />
  )
}

function PromoCouponSlide({ cfg, radius }: { cfg: PromoCouponConfig; radius: number }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(cfg.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable (e.g. insecure context) — silently ignore */
    }
  }

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})` }}>
      <PromoNotch side="left" bg="var(--p-bg)" />
      <PromoNotch side="right" bg="var(--p-bg)" />
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.8)', letterSpacing: '.12em', textTransform: 'uppercase' }}>{cfg.eyebrow}</div>
        <div style={{ fontFamily: 'var(--p-display)', fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1, margin: '5px 0 3px' }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.subtitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, height: 34, borderRadius: 9,
            border: '1.5px dashed rgba(255,255,255,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: '.12em',
            fontFamily: 'monospace', minWidth: 0, overflow: 'hidden',
          }}>{cfg.code}</div>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              height: 34, padding: '0 14px', borderRadius: 9, border: 'none',
              background: '#fff', color: cfg.bgStart, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >{copied ? '✓ Kopyalandı' : 'Kopyala'}</button>
        </div>
      </div>
    </div>
  )
}

function PromoFlashSlide({ cfg, radius }: { cfg: PromoFlashConfig; radius: number }) {
  const isRealCountdown = Boolean(parseCountdownTarget(cfg.timer))
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null)

  useEffect(() => {
    const target = parseCountdownTarget(cfg.timer)
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
  }, [cfg.timer])

  const units = timeLeft
    ? [
        { value: String(timeLeft.h).padStart(2, '0'), label: 'SA' },
        { value: String(timeLeft.m).padStart(2, '0'), label: 'DK' },
        { value: String(timeLeft.s).padStart(2, '0'), label: 'SN' },
      ]
    : []

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: '#13110f' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(217,119,87,.35), transparent 55%)' }} />
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          background: 'rgba(217,119,87,.18)', border: '1px solid rgba(217,119,87,.4)',
          padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
          color: '#ffd089', letterSpacing: '.06em',
        }}>{cfg.chip}</div>
        <div style={{ fontFamily: 'var(--p-display)', fontSize: 21, fontWeight: 700, color: '#fff', lineHeight: 1.05, margin: '6px 0 8px' }}>
          {cfg.title} <span style={{ color: '#ffd089' }}>{cfg.accentText}</span>
        </div>
        {isRealCountdown && timeLeft ? (
          <div style={{ display: 'flex', gap: 5 }}>
            {units.map((unit, i) => (
              <span key={unit.label} style={{ display: 'inline-flex', gap: 5 }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 16, alignSelf: 'flex-start', marginTop: 7 }}>:</span>}
                <span style={{ textAlign: 'center' }}>
                  <span style={{
                    width: 38, height: 34, borderRadius: 8,
                    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 17, fontWeight: 600,
                    fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
                  }}>{unit.value}</span>
                  <span style={{ display: 'block', fontSize: 8, color: 'rgba(255,255,255,.45)', fontWeight: 600, marginTop: 2, letterSpacing: '.1em' }}>{unit.label}</span>
                </span>
              </span>
            ))}
          </div>
        ) : cfg.timer ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>{cfg.timer}</div>
        ) : null}
      </div>
    </div>
  )
}

function PromoFreebieSlide({ cfg, radius }: { cfg: PromoFreebieConfig; radius: number }) {
  function handleCta() {
    if (!cfg.categoryId) return
    document.getElementById(`section-${cfg.categoryId}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: 'linear-gradient(120deg, #ffd089, #ffb347)' }}>
      <div style={{ position: 'absolute', right: -2, top: '50%', transform: 'translateY(-50%)', fontSize: 64, opacity: .9, animation: 'ps-floaty 4s ease-in-out infinite' }}>{cfg.emoji}</div>
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', maxWidth: '70%', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--p-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--p-accent)', marginBottom: 2 }}>{cfg.label}</div>
        <div style={{ fontFamily: 'var(--p-display)', fontSize: 20, fontWeight: 700, color: '#5a2a14', lineHeight: 1.1, margin: '0 0 4px' }}>{cfg.title}</div>
        <div style={{ fontSize: 11, color: '#7a4520', fontWeight: 500 }}>{cfg.subtitle}</div>
        {cfg.ctaText && (
          <button
            type="button"
            onClick={handleCta}
            style={{
              alignSelf: 'flex-start', marginTop: 8, height: 30, padding: '0 14px',
              borderRadius: 99, border: 'none', background: '#5a2a14', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: cfg.categoryId ? 'pointer' : 'default',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >{cfg.ctaText}</button>
        )}
      </div>
    </div>
  )
}

function PromoLoyaltySlide({ cfg, radius }: { cfg: PromoLoyaltyConfig; radius: number }) {
  const total = Math.max(1, Math.min(20, cfg.total))
  const filled = Math.max(0, Math.min(total, cfg.filled))
  const remaining = total - filled

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: 'linear-gradient(120deg, #2e7d63, #1f6b53)' }}>
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '.08em' }}>SADAKAT KARTIN</div>
            <div style={{ fontFamily: 'var(--p-display)', fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.title}</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.15)', borderRadius: 12, padding: '5px 9px', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--p-display)', fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
              {filled}<span style={{ fontSize: 12, opacity: .7 }}>/{total}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total},1fr)`, gap: 5, marginTop: 10 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 99,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              background: i < filled ? '#fff' : 'rgba(255,255,255,.12)',
              border: i < filled ? 'none' : '1px dashed rgba(255,255,255,.35)',
            }}>{i < filled ? '☕' : ''}</div>
          ))}
        </div>
        {remaining > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 8 }}>{remaining} kahve daha, ödülün hazır!</div>
        )}
      </div>
    </div>
  )
}

function PromoComboSlide({ cfg, radius }: { cfg: PromoComboConfig; radius: number }) {
  const priceNum = Number(cfg.price.replace(/[^\d.,]/g, '').replace(',', '.'))
  const oldPriceNum = Number(cfg.oldPrice.replace(/[^\d.,]/g, '').replace(',', '.'))
  const discount = Number.isFinite(priceNum) && Number.isFinite(oldPriceNum) && oldPriceNum > priceNum && oldPriceNum > 0
    ? Math.round((1 - priceNum / oldPriceNum) * 100)
    : null

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: 'var(--p-card)', border: '1.5px solid var(--p-border)' }}>
      <div style={{
        width: 120, flexShrink: 0, position: 'relative',
        background: cfg.imageUrl
          ? `url("${cfg.imageUrl}") center/cover`
          : 'linear-gradient(135deg, #ffe6d0, #ffd089)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50,
        overflow: 'hidden',
      }}>
        {!cfg.imageUrl && cfg.emoji}
        <div style={{
          position: 'absolute', top: 10, left: -28, transform: 'rotate(-45deg)',
          background: 'var(--p-accent)', color: '#fff', padding: '3px 34px',
          fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
        }}>COMBO</div>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--p-display)', fontSize: 19, fontWeight: 700, lineHeight: 1.1, color: 'var(--p-text)' }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: 'var(--p-text-2)', marginTop: 4 }}>{cfg.subtitle}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--p-accent)' }}>{cfg.price.startsWith('₺') ? cfg.price : `₺${cfg.price}`}</span>
          {cfg.oldPrice && (
            <span style={{ fontSize: 15, color: 'var(--p-text-2)', textDecoration: 'line-through' }}>{cfg.oldPrice.startsWith('₺') ? cfg.oldPrice : `₺${cfg.oldPrice}`}</span>
          )}
          {discount !== null && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#137a4d', padding: '2px 7px', borderRadius: 6 }}>%{discount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoSliderSection({ config }: { config: PromoSliderConfig }) {
  const slides: Array<{ id: string; node: ReactNode }> = []
  if (config.coupon.enabled) slides.push({ id: 'coupon', node: <PromoCouponSlide cfg={config.coupon} radius={config.radius} /> })
  if (config.flash.enabled) slides.push({ id: 'flash', node: <PromoFlashSlide cfg={config.flash} radius={config.radius} /> })
  if (config.freebie.enabled) slides.push({ id: 'freebie', node: <PromoFreebieSlide cfg={config.freebie} radius={config.radius} /> })
  if (config.loyalty.enabled) slides.push({ id: 'loyalty', node: <PromoLoyaltySlide cfg={config.loyalty} radius={config.radius} /> })
  if (config.combo.enabled) slides.push({ id: 'combo', node: <PromoComboSlide cfg={config.combo} radius={config.radius} /> })

  const slideCount = slides.length
  const hasClone = slideCount > 1
  // pos 0..slideCount-1 = real slides; pos === slideCount = clone of first (wrap step)
  const [pos, setPos] = useState(0)
  const scroller = useRef<HTMLDivElement | null>(null)
  const paused = useRef(false)
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raf = useRef(0)
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoplayOn = config.autoplay && slideCount > 1
  const slidesKey = slides.map((slide) => slide.id).join(',')

  // Reset scroll + position when the enabled-slide set changes (clone math must never go stale)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = 0
    setPos(0)
  }, [slidesKey])

  useEffect(() => {
    if (!autoplayOn) return
    const id = setInterval(() => {
      if (paused.current) return
      setPos((p) => Math.min(p + 1, slideCount))
    }, config.interval)
    return () => clearInterval(id)
  }, [autoplayOn, config.interval, slideCount])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = pos * el.clientWidth
    const snapToStart = () => {
      // keep programmatic=true during the snap so onScroll ignores it
      el.scrollLeft = 0
      setPos(0)
      requestAnimationFrame(() => { programmatic.current = false })
    }
    const finish = () => {
      if (hasClone && pos >= slideCount) snapToStart()
      else programmatic.current = false
    }
    if (Math.abs(el.scrollLeft - target) < 4) {
      if (hasClone && pos >= slideCount) { programmatic.current = true; snapToStart() }
      return
    }
    programmatic.current = true

    cancelAnimationFrame(raf.current)
    if (safety.current) clearTimeout(safety.current)
    const from = el.scrollLeft
    const dist = target - from
    if (Math.abs(dist) < 2) { el.scrollLeft = target; finish(); return }
    const dur = 420
    const start = performance.now()
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      el.scrollLeft = from + dist * ease(t)
      if (t < 1) raf.current = requestAnimationFrame(step)
      else finish()
    }
    raf.current = requestAnimationFrame(step)
    safety.current = setTimeout(() => {
      cancelAnimationFrame(raf.current)
      if (Math.abs(el.scrollLeft - target) > 2) el.scrollLeft = target
      finish()
    }, dur + 120)
  }, [pos, hasClone, slideCount])

  useEffect(() => () => {
    cancelAnimationFrame(raf.current)
    if (safety.current) clearTimeout(safety.current)
    if (settleTimer.current) clearTimeout(settleTimer.current)
  }, [])

  function handleScroll() {
    const el = scroller.current
    if (!el || programmatic.current) return
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const i = Math.round(el.scrollLeft / el.clientWidth)
      if (hasClone && i >= slideCount) {
        // user landed on the clone — snap to the real first slide instantly
        programmatic.current = true
        el.scrollLeft = 0
        setPos(0)
        requestAnimationFrame(() => { programmatic.current = false })
        return
      }
      setPos((prev) => (prev === i ? prev : i))
    }, 90)
  }

  if (slideCount === 0) return null

  // indicators map over REAL slides only; while the clone is visible, highlight 0
  const displayIdx = pos % slideCount
  const renderSlides = hasClone
    ? [...slides, { id: `${slides[0]!.id}-clone`, node: slides[0]!.node }]
    : slides

  return (
    <>
      <style>{`
        @keyframes ps-floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div
        onMouseEnter={() => { paused.current = true }}
        onMouseLeave={() => { paused.current = false }}
        onTouchStart={() => { paused.current = true }}
        onTouchEnd={() => { paused.current = false }}
      >
        <div
          ref={scroller}
          onScroll={handleScroll}
          style={{
            display: 'flex',
            overflowX: slideCount > 1 ? 'auto' : 'hidden',
            scrollSnapType: 'x mandatory',
            gap: 0,
            borderRadius: config.radius,
            scrollbarWidth: 'none',
          }}
        >
          {renderSlides.map((slide) => (
            <div key={slide.id} style={{ minWidth: '100%', scrollSnapAlign: 'center' }}>
              {slide.node}
            </div>
          ))}
        </div>

        {slideCount > 1 && config.indicator === 'dots' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Slayt ${i + 1}`}
                onClick={() => setPos(i)}
                style={{
                  width: i === displayIdx ? 20 : 6, height: 6, borderRadius: 99,
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: i === displayIdx ? 'var(--p-accent)' : 'var(--p-border)',
                  transition: 'all 300ms',
                }}
              />
            ))}
          </div>
        )}

        {slideCount > 1 && config.indicator === 'bars' && (
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                onClick={() => setPos(i)}
                style={{ flex: 1, height: 3, borderRadius: 99, cursor: 'pointer', background: 'var(--p-border)', overflow: 'hidden' }}
              >
                <div style={{
                  height: '100%',
                  width: i <= displayIdx ? '100%' : '0%',
                  background: 'var(--p-accent)',
                  transition: `width ${config.interval}ms linear`,
                }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function PromoSliderBlock({ config, memberLoyalty }: {
  config: Record<string, string>
  memberLoyalty?: { filled: number; total: number } | null
}) {
  const { text, number, bool } = makeReaders(config)
  const cfg: PromoSliderConfig = {
    autoplay: bool('autoplay', true),
    interval: Math.max(1500, number('interval', 2800)),
    indicator: (text('indicator', 'dots') === 'bars' ? 'bars' : 'dots'),
    radius: number('radius', 16),
    coupon: {
      enabled: bool('couponEnabled', true),
      eyebrow: text('couponEyebrow', 'İLK SİPARİŞE ÖZEL'),
      title: text('couponTitle', '%25 İndirim'),
      subtitle: text('couponSubtitle', '200₺ üzeri tüm siparişlerde geçerli'),
      code: text('couponCode', 'HOSGELDIN25'),
      bgStart: text('couponBgStart', '#a13b7a'),
      bgEnd: text('couponBgEnd', '#d4477f'),
    },
    flash: {
      enabled: bool('flashEnabled', true),
      chip: text('flashChip', '⚡ FLASH İNDİRİM'),
      title: text('flashTitle', 'Tatlılarda'),
      accentText: text('flashAccentText', '2 al 1 öde'),
      timer: text('flashTimer', '21:00'),
    },
    freebie: {
      enabled: bool('freebieEnabled', false),
      label: text('freebieLabel', 'Bugüne özel'),
      title: text('freebieTitle', 'Kahvenin yanında kurabiye bedava'),
      subtitle: text('freebieSubtitle', 'Her sıcak kahve siparişinde 🍪'),
      emoji: text('freebieEmoji', '🎁'),
      ctaText: text('freebieCtaText', 'Menüye git →'),
      categoryId: text('freebieCategoryId', ''),
    },
    loyalty: {
      enabled: bool('loyaltyEnabled', false),
      title: text('loyaltyTitle', '10. kahve bizden ☕'),
      // Real member progress when logged in; configured demo values otherwise.
      filled: memberLoyalty ? memberLoyalty.filled : number('loyaltyFilled', 6),
      total: memberLoyalty ? memberLoyalty.total : number('loyaltyTotal', 10),
    },
    combo: {
      enabled: bool('comboEnabled', true),
      title: text('comboTitle', 'İkili Burger Menü'),
      subtitle: text('comboSubtitle', '2 Burger + 2 Patates + 2 İçecek'),
      emoji: text('comboEmoji', '🍔🍟'),
      imageUrl: text('comboImageUrl', ''),
      price: text('comboPrice', '349'),
      oldPrice: text('comboOldPrice', '480'),
    },
  }

  return (
    <section data-component="custom-section" style={customSectionShell}>
      <PromoSliderSection config={cfg} />
    </section>
  )
}
