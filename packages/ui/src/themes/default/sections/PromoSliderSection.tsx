import React, { useEffect, useRef, useState } from 'react'
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
import { formatTRY } from '../../../menu/formatCurrency'
import { AllergenSummary } from '../../../menu/FoodInfoBadges'
import type { PromoSliderCampaign } from './promoSliderCampaignModel'
import { selectPromoSliderCampaigns } from './promoSliderCampaignModel'

const promoSlideBase: CSSProperties = {
  position: 'relative',
  minWidth: '100%',
  height: 170,
  overflow: 'hidden',
  display: 'flex',
  scrollSnapAlign: 'center',
}

export function formatPromoCampaignCountdown(expiresAtMs: number, now = Date.now()) {
  const remaining = Math.max(0, expiresAtMs - now)
  const totalSeconds = Math.floor(remaining / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':')
}

function CampaignCountdown({
  expiresAtMs,
  label,
  color,
}: {
  expiresAtMs: number | undefined
  label: string
  color: string
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (expiresAtMs === undefined) return
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 1_000)
    return () => window.clearInterval(id)
  }, [expiresAtMs])

  if (expiresAtMs === undefined || expiresAtMs <= now) return null

  return (
    <span
      className="garsonless-active-campaign-timer"
      aria-label={`${label}: ${formatPromoCampaignCountdown(expiresAtMs, now)}`}
      style={{
        marginTop: 6,
        minHeight: 24,
        padding: '4px 7px',
        borderRadius: 8,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        color,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 7,
        fontSize: 9,
        lineHeight: 1.1,
      }}
    >
      <span style={{ opacity: .68, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <strong style={{ width: '7.1ch', textAlign: 'right', fontSize: 11, letterSpacing: '.025em' }}>
        {formatPromoCampaignCountdown(expiresAtMs, now)}
      </strong>
    </span>
  )
}

function ActiveCampaignCountdown({ campaign }: { campaign: PromoSliderCampaign }) {
  const label = campaign.countdownLabel
    || (campaign.kind === 'daily-special' ? 'Bugün sona eriyor' : 'Fırsat bitiyor')
  return <CampaignCountdown expiresAtMs={campaign.expiresAtMs} label={label} color={campaign.textColor} />
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

async function copyPromoCode(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Local previews and cross-origin iframes may reject Clipboard API.
      // Continue with the synchronous selection fallback below.
    }
  }
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, value.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

function PromoCouponSlide({ cfg, radius }: { cfg: PromoCouponConfig; radius: number }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  async function handleCopy() {
    const copied = await copyPromoCode(cfg.code)
    setCopyStatus(copied ? 'copied' : 'error')
    window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})` }}>
      <PromoNotch side="left" bg="var(--p-bg)" />
      <PromoNotch side="right" bg="var(--p-bg)" />
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: `color-mix(in srgb, ${cfg.textColor} 80%, transparent)`, letterSpacing: '.12em', textTransform: 'uppercase' }}>{cfg.eyebrow}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: cfg.textColor, lineHeight: 1, margin: '5px 0 3px' }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: `color-mix(in srgb, ${cfg.textColor} 85%, transparent)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.subtitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, height: 34, borderRadius: 9,
            border: `1.5px dashed color-mix(in srgb, ${cfg.textColor} 60%, transparent)`,
            background: `color-mix(in srgb, ${cfg.accentColor} 14%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.textColor, fontSize: 14, fontWeight: 750, letterSpacing: '.08em',
            minWidth: 0, overflow: 'hidden',
          }}>{cfg.code}</div>
          <button
            type="button"
            className="garsonless-promo-action"
            onClick={handleCopy}
            aria-live="polite"
            style={{
              height: 34, padding: '0 14px', borderRadius: 9, border: 'none',
              background: cfg.buttonBgColor, color: cfg.buttonTextColor, fontSize: 12.5, fontWeight: 750,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >{copyStatus === 'copied' ? '✓ Kopyalandı' : copyStatus === 'error' ? 'Tekrar dene' : 'Kopyala'}</button>
        </div>
      </div>
    </div>
  )
}

function PromoFlashSlide({ cfg, radius }: { cfg: PromoFlashConfig; radius: number }) {
  return (
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})` }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 20%, color-mix(in srgb, ${cfg.accentColor} 35%, transparent), transparent 55%)` }} />
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          background: `color-mix(in srgb, ${cfg.accentColor} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${cfg.accentColor} 42%, transparent)`,
          padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
          color: cfg.accentColor, letterSpacing: '.06em',
        }}>{cfg.chip}</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: cfg.textColor, lineHeight: 1.05, margin: '6px 0 8px' }}>
          {cfg.title} <span style={{ color: cfg.accentColor }}>{cfg.accentText}</span>
        </div>
        {cfg.countdownEnabled && (
          <CampaignCountdown
            expiresAtMs={cfg.expiresAtMs}
            label={cfg.countdownLabel || 'Fırsat bitiyor'}
            color={cfg.textColor}
          />
        )}
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
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})`, color: cfg.textColor }}>
      <div style={{ position: 'absolute', right: -2, top: '50%', transform: 'translateY(-50%)', fontSize: 64, opacity: .9, animation: 'ps-floaty 4s ease-in-out infinite' }}>{cfg.emoji}</div>
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', maxWidth: '70%', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontStyle: 'italic', fontSize: 14, color: cfg.accentColor, marginBottom: 2 }}>{cfg.label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: cfg.textColor, lineHeight: 1.1, margin: '0 0 4px' }}>{cfg.title}</div>
        <div style={{ fontSize: 11, color: `color-mix(in srgb, ${cfg.textColor} 78%, transparent)`, fontWeight: 500 }}>{cfg.subtitle}</div>
        {cfg.ctaText && (
          <button
            type="button"
            className="garsonless-promo-action"
            onClick={handleCta}
            style={{
              alignSelf: 'flex-start', marginTop: 8, height: 30, padding: '0 14px',
              borderRadius: 99, border: 'none', background: cfg.buttonBgColor, color: cfg.buttonTextColor,
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
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})`, color: cfg.textColor }}>
      <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: `color-mix(in srgb, ${cfg.textColor} 75%, transparent)`, letterSpacing: '.08em' }}>SADAKAT KARTIN</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: cfg.textColor, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.title}</div>
          </div>
          <div style={{ textAlign: 'center', background: `color-mix(in srgb, ${cfg.textColor} 15%, transparent)`, borderRadius: 12, padding: '5px 9px', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: cfg.textColor, lineHeight: 1 }}>
              {filled}<span style={{ fontSize: 12, opacity: .7 }}>/{total}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total},1fr)`, gap: 5, marginTop: 10 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 99,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              color: cfg.textColor,
              background: i < filled ? cfg.accentColor : `color-mix(in srgb, ${cfg.textColor} 12%, transparent)`,
              border: i < filled ? 'none' : `1px dashed color-mix(in srgb, ${cfg.textColor} 35%, transparent)`,
            }}>{i < filled ? '☕' : ''}</div>
          ))}
        </div>
        {remaining > 0 && (
          <div style={{ fontSize: 11, color: `color-mix(in srgb, ${cfg.textColor} 70%, transparent)`, marginTop: 8 }}>{remaining} kahve daha, ödülün hazır!</div>
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
    <div style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})`, border: `1.5px solid color-mix(in srgb, ${cfg.accentColor} 24%, var(--p-border))`, color: cfg.textColor }}>
      <div style={{
        width: 120, flexShrink: 0, position: 'relative',
        background: `linear-gradient(135deg, color-mix(in srgb, ${cfg.accentColor} 12%, #fff), color-mix(in srgb, ${cfg.accentColor} 28%, #fff))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50,
        overflow: 'hidden',
      }}>
        {cfg.imageUrl ? (
          <img
            src={cfg.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', display: 'block', objectFit: cfg.imageFit, objectPosition: `center ${cfg.imagePosition}` }}
          />
        ) : cfg.emoji}
        <div style={{
          position: 'absolute', top: 10, left: -28, transform: 'rotate(-45deg)',
          background: cfg.accentColor, color: '#fff', padding: '3px 34px',
          fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
        }}>COMBO</div>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1, color: cfg.textColor }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: `color-mix(in srgb, ${cfg.textColor} 72%, transparent)`, marginTop: 4 }}>{cfg.subtitle}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: cfg.accentColor }}>{cfg.price.startsWith('₺') ? cfg.price : `₺${cfg.price}`}</span>
          {cfg.oldPrice && (
            <span style={{ fontSize: 15, color: `color-mix(in srgb, ${cfg.textColor} 62%, transparent)`, textDecoration: 'line-through' }}>{cfg.oldPrice.startsWith('₺') ? cfg.oldPrice : `₺${cfg.oldPrice}`}</span>
          )}
          {discount !== null && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#137a4d', padding: '2px 7px', borderRadius: 6 }}>%{discount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ActiveCampaignSlide({ campaign, radius }: { campaign: PromoSliderCampaign; radius: number }) {
  function revealSource() {
    document.getElementById(`custom-section-${campaign.sectionInstanceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <button
      type="button"
      className="garsonless-active-campaign-slide"
      data-campaign-kind={campaign.kind}
      data-has-countdown={campaign.expiresAtMs !== undefined ? 'true' : 'false'}
      onClick={revealSource}
      aria-label={`${campaign.title} kampanyasını menüde göster`}
      style={{
        ...promoSlideBase,
        borderRadius: radius,
        border: `1px solid color-mix(in srgb, ${campaign.accentColor} 22%, transparent)`,
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: campaign.backgroundColor,
        color: campaign.textColor,
      }}
    >
      <div style={{
        width: 'clamp(96px, 31%, 126px)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: campaign.imageUrl
          ? `url("${campaign.imageUrl}") center/cover`
          : `linear-gradient(135deg, color-mix(in srgb, ${campaign.accentColor} 18%, #fff), ${campaign.backgroundColor})`,
      }}>
        <span style={{
          position: 'absolute', left: 10, top: 10, maxWidth: 108,
          padding: '4px 8px', borderRadius: 999,
          background: campaign.accentColor, color: '#fff',
          fontSize: 9.5, lineHeight: 1.1, fontWeight: 850,
          letterSpacing: '.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{campaign.badge}</span>
      </div>
      <div className="garsonless-active-campaign-content" style={{ flex: 1, minWidth: 0, padding: '11px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
        <span style={{ color: campaign.textColor, opacity: .68, fontSize: 9, lineHeight: 1.1, fontWeight: 850, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          {campaign.sourceLabel}
        </span>
        <strong className="garsonless-active-campaign-title" style={{ marginTop: 4, fontSize: campaign.kind === 'combo-ribbon' ? 17 : 18, lineHeight: 1.08, color: campaign.textColor, overflow: 'hidden', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
          {campaign.title}
        </strong>
        <span style={{ marginTop: 4, color: campaign.textColor, opacity: .72, fontSize: 10.5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {campaign.subtitle}
        </span>
        <AllergenSummary definite={campaign.allergens} hasCrossContact={campaign.hasCrossContact} style={{marginTop:5}} />
        <ActiveCampaignCountdown campaign={campaign} />
        {campaign.price !== undefined && (
          <span className="garsonless-active-campaign-price" style={{ marginTop: campaign.expiresAtMs === undefined ? 8 : 6, display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            <strong style={{ color: campaign.textColor, fontSize: 17, lineHeight: 1, whiteSpace: 'nowrap' }}>{formatTRY(campaign.price)}</strong>
            {campaign.oldPrice !== undefined && campaign.oldPrice > campaign.price && (
              <span style={{ color: campaign.textColor, opacity: .5, fontSize: 11.5, textDecoration: 'line-through' }}>{formatTRY(campaign.oldPrice)}</span>
            )}
            <span aria-hidden="true" style={{ marginLeft: 'auto', color: campaign.textColor, opacity: .72, fontSize: 16 }}>→</span>
          </span>
        )}
      </div>
    </button>
  )
}

function PromoSliderSection({ config, campaigns = [] }: { config: PromoSliderConfig; campaigns?: PromoSliderCampaign[] }) {
  const [campaignClock, setCampaignClock] = useState(() => Date.now())
  const liveCampaigns = campaigns.filter((campaign) => campaign.expiresAtMs === undefined || campaign.expiresAtMs > campaignClock)
  const manualFlashLive = config.flash.enabled && (
    !config.flash.countdownEnabled
    || (config.flash.expiresAtMs !== undefined && config.flash.expiresAtMs > campaignClock)
  )
  const campaignExpiryKey = campaigns
    .map((campaign) => `${campaign.id}:${campaign.expiresAtMs ?? ''}`)
    .concat(config.flash.countdownEnabled ? [`manual-flash:${config.flash.expiresAtMs ?? ''}`] : [])
    .join(',')
  const nextCampaignExpiry = [
    ...liveCampaigns.map((campaign) => campaign.expiresAtMs),
    ...(manualFlashLive && config.flash.countdownEnabled ? [config.flash.expiresAtMs] : []),
  ]
    .filter((expiresAtMs): expiresAtMs is number => expiresAtMs !== undefined)
    .sort((a, b) => a - b)[0]

  useEffect(() => {
    const now = Date.now()
    if (nextCampaignExpiry === undefined) return
    const timeout = window.setTimeout(() => setCampaignClock(Date.now()), Math.max(0, nextCampaignExpiry - now) + 50)
    return () => window.clearTimeout(timeout)
  }, [campaignExpiryKey, nextCampaignExpiry])

  const slides: Array<{ id: string; node: ReactNode }> = []
  if (config.sourceMode !== 'manual') {
    for (const campaign of liveCampaigns) {
      slides.push({ id: `active-${campaign.id}`, node: <ActiveCampaignSlide campaign={campaign} radius={config.radius} /> })
    }
  }
  if (config.sourceMode !== 'active') {
    if (config.coupon.enabled) slides.push({ id: 'coupon', node: <PromoCouponSlide cfg={config.coupon} radius={config.radius} /> })
    if (manualFlashLive) slides.push({ id: 'flash', node: <PromoFlashSlide cfg={config.flash} radius={config.radius} /> })
    if (config.freebie.enabled) slides.push({ id: 'freebie', node: <PromoFreebieSlide cfg={config.freebie} radius={config.radius} /> })
    if (config.loyalty.enabled) slides.push({ id: 'loyalty', node: <PromoLoyaltySlide cfg={config.loyalty} radius={config.radius} /> })
    if (config.combo.enabled) slides.push({ id: 'combo', node: <PromoComboSlide cfg={config.combo} radius={config.radius} /> })
  }

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
        .garsonless-active-campaign-slide {
          container-type: inline-size;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }
        .garsonless-active-campaign-slide:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px color-mix(in srgb, var(--p-text) 12%, transparent);
        }
        .garsonless-active-campaign-slide:focus-visible,
        .garsonless-promo-action:focus-visible,
        .garsonless-promo-indicator:focus-visible {
          outline: 2px solid var(--p-accent);
          outline-offset: 2px;
        }
        .garsonless-promo-action {
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
        }
        .garsonless-promo-action:hover {
          transform: translateY(-1px);
          filter: brightness(.96);
          box-shadow: 0 5px 14px color-mix(in srgb, var(--p-text) 14%, transparent);
        }
        .garsonless-promo-action:active {
          transform: translateY(0) scale(.98);
        }
        .garsonless-active-campaign-timer {
          contain: layout paint;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 1;
        }
        @container (max-width: 350px) {
          .garsonless-active-campaign-content { padding: 10px 11px !important; }
          .garsonless-active-campaign-title { font-size: 16px !important; }
          .garsonless-active-campaign-price strong { font-size: 15px !important; }
          .garsonless-active-campaign-price { gap: 5px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .garsonless-active-campaign-slide { scroll-behavior: auto; }
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
                className="garsonless-promo-indicator"
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

const LEGACY_MANUAL_PREFIXES = ['coupon', 'flash', 'freebie', 'loyalty', 'combo'] as const

function resolveSourceMode(config: Record<string, string>): PromoSliderConfig['sourceMode'] {
  if (config.sourceMode === 'active' || config.sourceMode === 'mixed' || config.sourceMode === 'manual') return config.sourceMode
  return Object.keys(config).some((key) => LEGACY_MANUAL_PREFIXES.some((prefix) => key.startsWith(prefix)))
    ? 'manual'
    : 'active'
}

export function PromoSliderBlock({ config, memberLoyalty, sectionInstanceId = 'promo-slider', activeCampaigns = [] }: {
  config: Record<string, string>
  memberLoyalty?: { filled: number; total: number } | null
  sectionInstanceId?: string
  activeCampaigns?: PromoSliderCampaign[]
}) {
  const { text, number, bool } = makeReaders(config)
  const flashCampaignEndsAt = text('flashCampaignEndsAt', '')
  const parsedFlashCampaignEndsAt = Date.parse(flashCampaignEndsAt)
  const legacyFlashTarget = config.flashTimer ? parseCountdownTarget(config.flashTimer) : null
  const flashExpiresAtMs = Number.isFinite(parsedFlashCampaignEndsAt)
    ? parsedFlashCampaignEndsAt
    : legacyFlashTarget?.getTime()
  const flashCountdownEnabled = bool(
    'flashCountdownEnabled',
    Boolean(flashCampaignEndsAt || config.flashTimer),
  )
  const cfg: PromoSliderConfig = {
    sourceMode: resolveSourceMode(config),
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
      textColor: text('couponTextColor', '#ffffff'),
      accentColor: text('couponAccentColor', '#ffffff'),
      buttonBgColor: text('couponButtonBgColor', '#ffffff'),
      buttonTextColor: text('couponButtonTextColor', '#a13b7a'),
    },
    flash: {
      enabled: bool('flashEnabled', true),
      chip: text('flashChip', '⚡ FLASH İNDİRİM'),
      title: text('flashTitle', 'Tatlılarda'),
      accentText: text('flashAccentText', '2 al 1 öde'),
      countdownEnabled: flashCountdownEnabled,
      ...(flashExpiresAtMs !== undefined ? { expiresAtMs: flashExpiresAtMs } : {}),
      countdownLabel: text('flashCountdownLabel', 'Fırsat bitiyor'),
      bgStart: text('flashBgStart', '#13110f'),
      bgEnd: text('flashBgEnd', '#211a16'),
      textColor: text('flashTextColor', '#ffffff'),
      accentColor: text('flashAccentColor', '#ffd089'),
    },
    freebie: {
      enabled: bool('freebieEnabled', false),
      label: text('freebieLabel', 'Bugüne özel'),
      title: text('freebieTitle', 'Kahvenin yanında kurabiye bedava'),
      subtitle: text('freebieSubtitle', 'Her sıcak kahve siparişinde 🍪'),
      emoji: text('freebieEmoji', '🎁'),
      ctaText: text('freebieCtaText', 'Menüye git →'),
      categoryId: text('freebieCategoryId', ''),
      bgStart: text('freebieBgStart', '#ffd089'),
      bgEnd: text('freebieBgEnd', '#ffb347'),
      textColor: text('freebieTextColor', '#5a2a14'),
      accentColor: text('freebieAccentColor', '#a13b7a'),
      buttonBgColor: text('freebieButtonBgColor', '#5a2a14'),
      buttonTextColor: text('freebieButtonTextColor', '#ffffff'),
    },
    loyalty: {
      enabled: bool('loyaltyEnabled', false),
      title: text('loyaltyTitle', '10. kahve bizden ☕'),
      // Real member progress when logged in; configured demo values otherwise.
      filled: memberLoyalty ? memberLoyalty.filled : number('loyaltyFilled', 6),
      total: memberLoyalty ? memberLoyalty.total : number('loyaltyTotal', 10),
      bgStart: text('loyaltyBgStart', '#2e7d63'),
      bgEnd: text('loyaltyBgEnd', '#1f6b53'),
      textColor: text('loyaltyTextColor', '#ffffff'),
      accentColor: text('loyaltyAccentColor', '#ffffff'),
    },
    combo: {
      enabled: bool('comboEnabled', true),
      title: text('comboTitle', 'İkili Burger Menü'),
      subtitle: text('comboSubtitle', '2 Burger + 2 Patates + 2 İçecek'),
      emoji: text('comboEmoji', '🍔🍟'),
      imageUrl: text('comboImageUrl', ''),
      price: text('comboPrice', '349'),
      oldPrice: text('comboOldPrice', '480'),
      bgStart: text('comboBgStart', '#ffffff'),
      bgEnd: text('comboBgEnd', '#ffffff'),
      textColor: text('comboTextColor', '#1c1d20'),
      accentColor: text('comboAccentColor', '#a13b7a'),
      imageFit: text('comboImageFit', 'cover') === 'contain' ? 'contain' : 'cover',
      imagePosition: text('comboImagePosition', 'center') === 'top'
        ? 'top'
        : text('comboImagePosition', 'center') === 'bottom'
          ? 'bottom'
          : 'center',
    },
  }
  const campaigns = selectPromoSliderCampaigns(activeCampaigns, config.activeCampaignIds)

  return (
    <section id={`custom-section-${sectionInstanceId}`} data-component="custom-section" data-section-kind="promo-slider" style={customSectionShell}>
      <PromoSliderSection config={cfg} campaigns={campaigns} />
    </section>
  )
}
