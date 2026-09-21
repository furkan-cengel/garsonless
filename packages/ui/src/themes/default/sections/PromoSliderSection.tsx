'use client'

import { useMenuLocale } from '../../../menu/MenuLocaleContext'
import { useMenuReaders } from '../../../menu/MenuLocaleContext'
import React, { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { customSectionShell, parseCountdownTarget } from '../lib/sectionHelpers'
import type {
  PromoCouponConfig,
  PromoFlashConfig,
  PromoFreebieConfig,
  PromoLoyaltyConfig,
  PromoSliderConfig,
  PromoSliderActionConfig,
} from '../lib/sectionTypes'
import { formatTRY } from '../../../menu/formatCurrency'
import { AllergenSummary } from '../../../menu/FoodInfoBadges'
import type { MenuItem, SectionPromotionContext } from '../../../menu/types'
import type { FreebieAddRequest } from '../../types'
import type { MemberOpenTarget } from '../../types'
import type { PromoSliderCampaign } from './promoSliderCampaignModel'
import { selectPromoSliderCampaigns } from './promoSliderCampaignModel'
import { resolveSectionPromotionPrice } from '@garsonless/domain/menu'
import { AppIcons } from '../../../icons'
import { LoyaltyCardShell } from '../../../menu/LoyaltyCard'
import { TAG_SHIMMER_TARGET_CLASS, tagShimmerScopeClass } from '../../../menu/tagShimmer'

type PromoSliderTheme = Pick<GarsonlessTheme, 'motion' | 'tagShimmer'>

const promoSlideBase: CSSProperties = {
  position: 'relative',
  minWidth: '100%',
  height: 170,
  overflow: 'hidden',
  display: 'flex',
  scrollSnapAlign: 'center',
}

const promoTitleTypography: CSSProperties = {
  fontFamily: 'var(--p-display)',
}

interface ResolvedPromoAction {
  label: string
  ariaLabel: string
  run: () => void
}

interface PromoActionHandlers {
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  onAddFreebie?: (campaign: FreebieAddRequest) => void
  onOpenCart?: () => void
  onOpenMember?: (target?: MemberOpenTarget) => void
  onSelectCategory?: (categoryId: string) => void
}

function resolvePromoAction(
  action: PromoSliderActionConfig,
  items: MenuItem[],
  handlers: PromoActionHandlers,
  subject: string,
  memberTarget: MemberOpenTarget = 'overview',
): ResolvedPromoAction | null {
  if (action.type === 'category' && action.categoryId && handlers.onSelectCategory) {
    return { label: action.ctaText, ariaLabel: `${subject}: ${action.ctaText}`, run: () => handlers.onSelectCategory?.(action.categoryId) }
  }
  if (action.type === 'product' && action.productId && handlers.onQuickAdd) {
    const item = items.find((candidate) => candidate.id === action.productId && candidate.is_available)
    if (item) return { label: action.ctaText, ariaLabel: `${item.name}: ${action.ctaText}`, run: () => handlers.onQuickAdd?.(item) }
  }
  if (action.type === 'cart' && handlers.onOpenCart) {
    return { label: action.ctaText, ariaLabel: `${subject}: ${action.ctaText}`, run: handlers.onOpenCart }
  }
  if (action.type === 'member' && handlers.onOpenMember) {
    return { label: action.ctaText, ariaLabel: `${subject}: ${action.ctaText}`, run: () => handlers.onOpenMember?.(memberTarget) }
  }
  return null
}

function PromoActionButton({ action, background, color, compact = false }: {
  action: ResolvedPromoAction | null
  background: string
  color: string
  compact?: boolean
}) {
  const { t } = useMenuLocale()
  if (!action) return null
  return (
    <button
      type="button"
      className="garsonless-promo-action"
      onClick={action.run}
      aria-label={t(action.ariaLabel)}
      style={{
        minHeight: compact ? 30 : 34,
        padding: compact ? '0 11px' : '0 14px',
        borderRadius: 999,
        border: 'none',
        background,
        color,
        fontSize: compact ? 11 : 12,
        fontWeight: 750,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >{t(action.label)}</button>
  )
}

export function formatPromoCampaignCountdown(expiresAtMs: number, now = Date.now()) {
  const remaining = Math.max(0, expiresAtMs - now)
  const totalSeconds = Math.floor(remaining / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':')
}

export function resolvePromoSliderResizeScrollLeft({
  programmatic,
  position,
  slideCount,
  width,
}: {
  programmatic: boolean
  position: number
  slideCount: number
  width: number
}) {
  if (programmatic || width <= 0) return null
  return (position % Math.max(1, slideCount)) * width
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
  const { t } = useMenuLocale();
  const label = campaign.countdownLabel
    || (campaign.kind === 'daily-special' ? t("Bugün sona eriyor") : t("Fırsat bitiyor"))
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
  const { t } = useMenuLocale()
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
        <div style={{ ...promoTitleTypography, fontSize: 26, fontWeight: 800, color: cfg.textColor, lineHeight: 1, margin: '5px 0 3px' }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: `color-mix(in srgb, ${cfg.textColor} 85%, transparent)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.subtitle}</div>
        {cfg.code.trim() && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div className={TAG_SHIMMER_TARGET_CLASS} style={{
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
          >{t(copyStatus === 'copied' ? '✓ Kopyalandı' : copyStatus === 'error' ? 'Tekrar dene' : 'Kopyala')}</button>
        </div>}
      </div>
    </div>
  )
}

function PromoFlashSlide({ cfg, radius, action, items, onQuickAdd, sectionInstanceId, editorPreview }: {
  cfg: PromoFlashConfig
  radius: number
  action: ResolvedPromoAction | null
  items: MenuItem[]
  onQuickAdd?: PromoActionHandlers['onQuickAdd']
  sectionInstanceId: string
  editorPreview: boolean
}) {
  const { t } = useMenuLocale();
  const eligibleItems = cfg.itemIds.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id && candidate.is_available)
    return item ? [item] : []
  }).filter((item, index, collection) => (
    collection.findIndex((candidate) => candidate.id === item.id) === index
  ))
  const [selectedId, setSelectedId] = useState(() => eligibleItems[0]?.id ?? '')
  const selectedItem = eligibleItems.find((item) => item.id === selectedId) ?? eligibleItems[0]
  const pricing = selectedItem && cfg.offerType === 'buy-2-pay-1'
    ? resolveSectionPromotionPrice({ catalogPrice: selectedItem.price, mode: 'buy-2-pay-1' })
    : null
  const rawChipLabel = cfg.chip.trim()
  const chipLabel = (
    rawChipLabel.startsWith('⚡️')
      ? rawChipLabel.slice(2)
      : rawChipLabel.startsWith('⚡')
        ? rawChipLabel.slice(1)
        : rawChipLabel
  ).trim() || t('FLASH İNDİRİM')

  function addPair() {
    if (!selectedItem || pricing?.kind !== 'buy-2-pay-1' || !onQuickAdd) return
    onQuickAdd(
      { ...selectedItem, price: pricing.price },
      selectedItem.price,
      { sectionInstanceId, kind: 'promo-slider', quantityStep: pricing.quantity },
    )
  }

  return (
    <div
      data-component="promo-flash-slide"
      style={{
        ...promoSlideBase,
        borderRadius: radius,
        background: `linear-gradient(128deg, ${cfg.bgStart}, ${cfg.bgEnd})`,
        border: `1px solid color-mix(in srgb, ${cfg.accentColor} 22%, transparent)`,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${cfg.textColor} 8%, transparent), 0 12px 28px -20px ${cfg.bgStart}`,
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', width: 190, height: 190, right: -58, top: -92, borderRadius: '50%', background: `color-mix(in srgb, ${cfg.accentColor} 12%, transparent)`, filter: 'blur(2px)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', width: 110, height: 110, left: -62, bottom: -72, borderRadius: '50%', border: `22px solid color-mix(in srgb, ${cfg.accentColor} 7%, transparent)` }} />
      <div style={{ flex: 1, padding: '13px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div className={TAG_SHIMMER_TARGET_CLASS} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 25,
            background: `color-mix(in srgb, ${cfg.accentColor} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${cfg.accentColor} 46%, transparent)`,
            padding: '0 9px', borderRadius: 99, fontSize: 9.5, lineHeight: 1, fontWeight: 800,
            color: cfg.accentColor, letterSpacing: '.075em', whiteSpace: 'nowrap',
          }}><AppIcons.zap size={12} aria-hidden="true" />{chipLabel}</div>
          {cfg.countdownEnabled && (
            <div style={{ marginLeft: 'auto', minWidth: 0 }}>
              <CampaignCountdown
                expiresAtMs={cfg.expiresAtMs}
                label={cfg.countdownLabel || t("Fırsat bitiyor")}
                color={cfg.textColor}
              />
            </div>
          )}
        </div>
        <div style={{ ...promoTitleTypography, fontSize: 21.5, fontWeight: 800, color: cfg.textColor, lineHeight: 1.05, margin: '6px 0 9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cfg.title} <span style={{ color: cfg.accentColor }}>{cfg.accentText}</span>
        </div>
        {cfg.offerType === 'buy-2-pay-1' ? (
          eligibleItems.length > 0 && pricing?.kind === 'buy-2-pay-1' ? (
            <div
              data-component="promo-flash-offer-panel"
              style={{
                minHeight: 49, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'stretch', gap: 5,
                padding: 4, borderRadius: 13,
                background: `color-mix(in srgb, ${cfg.textColor} 7%, transparent)`,
                border: `1px solid color-mix(in srgb, ${cfg.textColor} 11%, transparent)`,
                boxShadow: `inset 0 1px 0 color-mix(in srgb, ${cfg.textColor} 7%, transparent)`,
              }}
            >
              {eligibleItems.length > 1 ? (
                <label data-component="promo-flash-product-selector" style={{ position: 'relative', minWidth: 0, padding: '5px 28px 4px 9px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}>
                  <span style={{ color: `color-mix(in srgb, ${cfg.textColor} 58%, transparent)`, fontSize: 7.5, lineHeight: 1, fontWeight: 800, letterSpacing: '.09em' }}>{t("KAMPANYA ÜRÜNÜ")}</span>
                  <strong aria-hidden="true" style={{ height: 23, display: 'flex', alignItems: 'center', overflow: 'hidden', color: cfg.textColor, font: '750 12px inherit', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{selectedItem?.name}</strong>
                  <select
                    className="garsonless-promo-flash-select"
                    aria-label={t("2 al 1 öde kampanya ürünü")}
                    value={selectedItem?.id ?? ''}
                    onChange={(event) => setSelectedId(event.target.value)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, padding: 0, appearance: 'none', WebkitAppearance: 'none', border: 0, outline: 0, opacity: 0, cursor: 'pointer' }}
                  >
                    {eligibleItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <AppIcons.chevDown aria-hidden="true" size={13} style={{ position: 'absolute', right: 8, bottom: 9, color: `color-mix(in srgb, ${cfg.textColor} 72%, transparent)`, pointerEvents: 'none' }} />
                </label>
              ) : (
                <div
                  data-component="promo-flash-static-product"
                  style={{ minWidth: 0, padding: '5px 9px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                >
                  <span style={{ color: `color-mix(in srgb, ${cfg.textColor} 58%, transparent)`, fontSize: 7.5, lineHeight: 1, fontWeight: 800, letterSpacing: '.09em' }}>{t("KAMPANYA ÜRÜNÜ")}</span>
                  <strong style={{ height: 23, display: 'flex', alignItems: 'center', overflow: 'hidden', color: cfg.textColor, font: '750 12px inherit', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{selectedItem?.name}</strong>
                </div>
              )}
              {onQuickAdd && (
                <button
                  type="button"
                  className="garsonless-promo-action"
                  data-component="promo-flash-pair-action"
                  onClick={addPair}
                  aria-label={t("{name} ürününden iki adedi 2 al 1 öde kampanyasıyla sepete ekle", { name: selectedItem?.name ?? t("Seçili ürün") })}
                  style={{ minWidth: 118, minHeight: 41, border: 0, borderRadius: 10, padding: '4px 11px', background: cfg.accentColor, color: cfg.bgStart, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', boxShadow: `0 8px 18px -12px ${cfg.accentColor}` }}
                >
                  <span style={{ fontSize: 7.5, lineHeight: 1, fontWeight: 850, letterSpacing: '.08em', opacity: .72 }}>{t("2 ÜRÜN · TEK FİYAT")}</span>
                  <strong style={{ marginTop: 3, fontSize: 14, lineHeight: 1, fontWeight: 850 }}>{formatTRY(pricing.totalPrice)}</strong>
                </button>
              )}
            </div>
          ) : editorPreview ? (
            <div role="status" style={{ minHeight: 45, padding: '0 12px', borderRadius: 12, border: `1px dashed color-mix(in srgb, ${cfg.accentColor} 45%, transparent)`, background: `color-mix(in srgb, ${cfg.accentColor} 8%, transparent)`, color: cfg.accentColor, display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 750 }}>{t("Kampanya için en az bir satıştaki ürün seçin.")}</div>
          ) : null
        ) : (
          <div style={{ marginTop: 8 }}><PromoActionButton action={action} background={cfg.accentColor} color={cfg.bgStart} compact /></div>
        )}
      </div>
    </div>
  )
}

function PromoFreebieSlide({ cfg, radius, action, items, onAddFreebie, sectionInstanceId, editorPreview }: {
  cfg: PromoFreebieConfig
  radius: number
  action: ResolvedPromoAction | null
  items: MenuItem[]
  onAddFreebie?: (campaign: FreebieAddRequest) => void
  sectionInstanceId: string
  editorPreview: boolean
}) {
  const { t } = useMenuLocale();
  const availableItems = items.filter((item) => item.is_available)
  const qualifierItems = cfg.qualifierMode === 'category'
    ? availableItems.filter((item) => item.category_id === cfg.qualifierCategoryId)
    : cfg.qualifierItemIds.flatMap((id) => availableItems.find((item) => item.id === id) ?? [])
  const rewardItems = cfg.rewardItemIds.flatMap((id) => availableItems.find((item) => item.id === id) ?? [])
  const functional = cfg.offerType === 'gift-with-purchase'
  const canStart = functional && qualifierItems.length > 0 && rewardItems.length > 0 && Boolean(onAddFreebie)
  const firstQualifier = qualifierItems[0]
  const firstReward = rewardItems[0]
  const imageUrl = cfg.imageSource === 'custom'
    ? cfg.imageUrl
    : cfg.imageSource === 'qualifier'
      ? firstQualifier?.images[0] ?? ''
      : cfg.imageSource === 'reward'
        ? firstReward?.images[0] ?? ''
        : ''
  const showEmoji = cfg.imageSource === 'emoji' || (!imageUrl && cfg.imageSource !== 'none')
  const media = imageUrl ? (
    <img src={imageUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', display: 'block', objectFit: cfg.imageFit, objectPosition: `center ${cfg.imagePosition}` }} />
  ) : showEmoji ? <span aria-hidden="true" style={{ fontSize: 56, lineHeight: 1 }}>{cfg.emoji}</span> : null
  const rewardName = firstReward?.name ?? ''

  const mediaSurface = media ? (
    <div
      data-component="promo-freebie-media"
      aria-hidden="true"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: `color-mix(in srgb, ${cfg.textColor} 6%, #fff)`,
      }}
    >
      {media}
      {rewardName && (
        <span className={TAG_SHIMMER_TARGET_CLASS} style={{ position: 'absolute', left: 8, right: 8, bottom: 8, minHeight: 27, padding: '5px 8px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.92)', color: cfg.textColor, boxShadow: '0 5px 14px rgba(38,22,12,.12)', fontSize: 9.5, lineHeight: 1.05, fontWeight: 800 }}>
          <AppIcons.gift size={12} strokeWidth={2.1} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rewardName}</span>
        </span>
      )}
    </div>
  ) : null

  function startCampaign() {
    if (!canStart) return
    onAddFreebie?.({
      sectionInstanceId,
      title: cfg.title,
      ...(cfg.qualifierMode === 'category' && cfg.qualifierCategoryId ? { qualifierCategoryId: cfg.qualifierCategoryId } : {}),
      qualifierItems,
      rewardItems,
    })
  }

  if (functional && !canStart && !editorPreview) return null

  return (
    <div data-component="promo-freebie-slide" data-layout={cfg.layout} style={{ ...promoSlideBase, borderRadius: radius, background: `linear-gradient(120deg, ${cfg.bgStart}, ${cfg.bgEnd})`, color: cfg.textColor, border: `1px solid color-mix(in srgb, ${cfg.accentColor} 24%, transparent)`, boxShadow: `inset 0 1px 0 color-mix(in srgb, #fff 28%, transparent), 0 12px 28px -22px ${cfg.textColor}` }}>
      {cfg.layout === 'cover' && mediaSurface && <div style={{ position: 'absolute', inset: 0 }}>{mediaSurface}<span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,10,12,.84), rgba(8,10,12,.57) 62%, rgba(8,10,12,.24))' }} /></div>}
      {cfg.layout === 'split' && mediaSurface && <div style={{ width: '38%', flexShrink: 0, overflow: 'hidden', borderRight: `1px solid color-mix(in srgb, ${cfg.textColor} 10%, transparent)` }}>{mediaSurface}</div>}
      {cfg.layout === 'media-right' && mediaSurface && <div style={{ position: 'absolute', right: 11, top: 11, bottom: 11, width: 'clamp(104px, 32%, 122px)', borderRadius: Math.max(10, radius - 5), overflow: 'hidden', border: `1px solid color-mix(in srgb, ${cfg.textColor} 9%, transparent)`, boxShadow: `0 10px 24px -18px ${cfg.textColor}` }}>{mediaSurface}</div>}
      <div data-component="promo-freebie-content" style={{ flex: 1, padding: cfg.layout === 'split' ? '13px 15px' : '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', position: 'relative', maxWidth: cfg.layout === 'media-right' && mediaSurface ? 'calc(100% - 138px)' : cfg.layout === 'cover' ? '76%' : undefined, minWidth: 0, minHeight: 0, overflow: 'hidden', color: cfg.layout === 'cover' && mediaSurface ? '#fff' : cfg.textColor }}>
        <div className={TAG_SHIMMER_TARGET_CLASS} style={{ minHeight: 22, padding: '0 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5, background: `color-mix(in srgb, ${cfg.accentColor} 14%, transparent)`, color: cfg.layout === 'cover' && mediaSurface ? '#fff' : cfg.accentColor, fontSize: 9.5, lineHeight: 1, fontWeight: 850, letterSpacing: '.05em', textTransform: 'uppercase' }}><AppIcons.gift size={12} strokeWidth={2.1} />{cfg.label}</div>
        <div style={{ ...promoTitleTypography, fontSize: 18.5, fontWeight: 800, color: 'inherit', lineHeight: 1.08, letterSpacing: '-.012em', margin: '7px 0 4px', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{cfg.title}</div>
        <div style={{ width: '100%', fontSize: 10.75, lineHeight: 1.25, color: 'inherit', opacity: .76, fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.subtitle}</div>
        {functional ? (
          canStart ? <button type="button" className="garsonless-promo-action" onClick={startCampaign} style={{ maxWidth: '100%', minHeight: 32, marginTop: 9, padding: '0 11px', border: 0, borderRadius: 10, background: cfg.buttonBgColor, color: cfg.buttonTextColor, font: '800 10.5px inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.ctaText || t("Hediyeni seç")}</span><AppIcons.chevRight size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} /></button>
            : <div role="status" style={{ marginTop: 7, fontSize: 10.5, lineHeight: 1.3, fontWeight: 750 }}>{t("Satışta uygun ana ürün ve hediye seçin.")}</div>
        ) : <div style={{ alignSelf: 'flex-start', marginTop: 8 }}><PromoActionButton action={action} background={cfg.buttonBgColor} color={cfg.buttonTextColor} compact /></div>}
      </div>
    </div>
  )
}

function PromoLoyaltySlide({ cfg, radius, action }: { cfg: PromoLoyaltyConfig; radius: number; action: ResolvedPromoAction | null }) {
  const { t } = useMenuLocale()
  return (
    <div data-component="promo-loyalty-front" style={{ ...promoSlideBase, borderRadius: radius }}>
      <LoyaltyCardShell
        className="garsonless-loyalty-card"
        background={cfg.bgStart}
        foreground={cfg.textColor}
        accent={cfg.accentColor}
        {...(action ? { onClick: action.run, ariaLabel: action.ariaLabel } : {})}
        style={{ height: '100%', borderRadius: radius, padding: 17 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 88px', gap: 12, alignItems: 'start', paddingBottom: 40 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  background: '#fffdf7',
                  color: cfg.bgEnd,
                  backgroundImage: cfg.logoUrl ? `url("${cfg.logoUrl.replaceAll('"', '%22')}")` : undefined,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'contain',
                  fontWeight: 850,
                }}
              >{cfg.logoUrl ? null : cfg.restaurantName.trim().slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, opacity: .72, letterSpacing: '.12em' }}>{cfg.eyebrow}</div>
                <div style={{ fontSize: 12, fontWeight: 750, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.restaurantName}</div>
              </div>
            </div>
            <div style={{ ...promoTitleTypography, fontSize: 20, fontWeight: 800, color: cfg.textColor, lineHeight: 1.08, marginTop: 10, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{cfg.title}</div>
          </div>
          <span aria-hidden="true" style={{ width: 82, height: 82, borderRadius: '50%', border: `1px solid color-mix(in srgb, ${cfg.accentColor} 74%, transparent)`, background: `color-mix(in srgb, ${cfg.textColor} 9%, transparent)`, color: cfg.textColor, display: 'grid', placeItems: 'center', position: 'relative' }}>
            <AppIcons.coffee size={38} strokeWidth={1.65} />
            <span style={{ position: 'absolute', right: -3, bottom: 4, width: 27, height: 27, borderRadius: '50%', display: 'grid', placeItems: 'center', background: cfg.accentColor, color: cfg.bgEnd, border: `3px solid ${cfg.bgStart}` }}><AppIcons.gift size={13} strokeWidth={2.2} /></span>
          </span>
        </div>
        <span className={TAG_SHIMMER_TARGET_CLASS} style={{ position: 'absolute', left: 17, right: 17, bottom: 14, minHeight: 32, padding: '0 11px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fffdf7', color: cfg.bgEnd }}>
          <span style={{ minWidth: 0, fontSize: 10.5, fontWeight: 750, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(cfg.authenticated ? 'Sadakat kartın hazır' : 'Üyelere özel kahve ödülü')}</span>
          {action ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 10.5, fontWeight: 850 }}>{action.label}<AppIcons.chevRight size={13} /></span> : null}
        </span>
      </LoyaltyCardShell>
    </div>
  )
}

function ActiveCampaignSlide({ campaign, radius }: { campaign: PromoSliderCampaign; radius: number }) {
  const { t } = useMenuLocale()
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
      aria-label={t("{name} kampanyasını menüde göster", { name: campaign.title })}
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
        <span className={TAG_SHIMMER_TARGET_CLASS} style={{
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
        <strong className="garsonless-active-campaign-title" style={{ ...promoTitleTypography, marginTop: 4, fontSize: campaign.kind === 'combo-ribbon' ? 17 : 18, lineHeight: 1.08, color: campaign.textColor, overflow: 'hidden', overflowWrap: 'anywhere', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
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

function PromoSliderSection({
  config,
  campaigns = [],
  items,
  handlers,
  sectionInstanceId,
  editorPreview,
}: {
  config: PromoSliderConfig
  campaigns?: PromoSliderCampaign[]
  items: MenuItem[]
  handlers: PromoActionHandlers
  sectionInstanceId: string
  editorPreview: boolean
}) {
  const { t } = useMenuLocale()
  const [campaignClock, setCampaignClock] = useState(() => Date.now())
  const liveCampaigns = campaigns.filter((campaign) => campaign.expiresAtMs === undefined || campaign.expiresAtMs > campaignClock)
  const flashLive = config.flash.enabled && (
    !config.flash.countdownEnabled
    || (config.flash.expiresAtMs !== undefined && config.flash.expiresAtMs > campaignClock)
  )
  const freebieLive = config.freebie.enabled && (
    !config.freebie.timingEnabled
    || (
      config.freebie.startsAtMs !== undefined
      && config.freebie.endsAtMs !== undefined
      && config.freebie.startsAtMs <= campaignClock
      && config.freebie.endsAtMs > campaignClock
    )
  )
  const campaignExpiryKey = campaigns
    .map((campaign) => `${campaign.id}:${campaign.expiresAtMs ?? ''}`)
    .concat(config.flash.countdownEnabled ? [`manual-flash:${config.flash.expiresAtMs ?? ''}`] : [])
    .concat(config.freebie.timingEnabled ? [`manual-freebie:${config.freebie.startsAtMs ?? ''}:${config.freebie.endsAtMs ?? ''}`] : [])
    .join(',')
  const nextCampaignExpiry = [
    ...liveCampaigns.map((campaign) => campaign.expiresAtMs),
    ...(flashLive && config.flash.countdownEnabled ? [config.flash.expiresAtMs] : []),
    ...(config.freebie.timingEnabled && config.freebie.startsAtMs !== undefined && config.freebie.startsAtMs > campaignClock ? [config.freebie.startsAtMs] : []),
    ...(freebieLive && config.freebie.timingEnabled ? [config.freebie.endsAtMs] : []),
  ]
    .filter((expiresAtMs): expiresAtMs is number => expiresAtMs !== undefined)
    .sort((a, b) => a - b)[0]

  useEffect(() => {
    const now = Date.now()
    if (nextCampaignExpiry === undefined) return
    const delay = Math.min(Math.max(0, nextCampaignExpiry - now) + 50, 60 * 60 * 1_000)
    const timeout = window.setTimeout(() => setCampaignClock(Date.now()), delay)
    return () => window.clearTimeout(timeout)
  }, [campaignClock, campaignExpiryKey, nextCampaignExpiry])

  const slides: Array<{ id: string; node: ReactNode }> = []
  const flashAction = resolvePromoAction(config.flash.action, items, handlers, config.flash.title)
  const freebieAction = resolvePromoAction(config.freebie.action, items, handlers, config.freebie.title)
  const loyaltyAction = resolvePromoAction(config.loyalty.action, items, handlers, config.loyalty.title, 'loyalty')
  for (const campaign of liveCampaigns) {
    slides.push({ id: `active-${campaign.id}`, node: <ActiveCampaignSlide campaign={campaign} radius={config.radius} /> })
  }
  if (config.coupon.enabled) slides.push({ id: 'coupon', node: <PromoCouponSlide cfg={config.coupon} radius={config.radius} /> })
  if (flashLive) slides.push({
    id: 'flash',
    node: <PromoFlashSlide cfg={config.flash} radius={config.radius} action={flashAction} items={items} onQuickAdd={handlers.onQuickAdd} sectionInstanceId={sectionInstanceId} editorPreview={editorPreview} />,
  })
  if (freebieLive) slides.push({ id: 'freebie', node: <PromoFreebieSlide cfg={config.freebie} radius={config.radius} action={freebieAction} items={items} {...(handlers.onAddFreebie ? { onAddFreebie: handlers.onAddFreebie } : {})} sectionInstanceId={sectionInstanceId} editorPreview={editorPreview} /> })
  if (config.loyalty.enabled) slides.push({ id: 'loyalty', node: <PromoLoyaltySlide cfg={config.loyalty} radius={config.radius} action={loyaltyAction} /> })

  const slideCount = slides.length
  const hasClone = slideCount > 1
  // pos 0..slideCount-1 = real slides; pos === slideCount = clone of first (wrap step)
  const [pos, setPos] = useState(0)
  const [manualPaused, setManualPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pauseVersion, setPauseVersion] = useState(0)
  const [autoplayReset, setAutoplayReset] = useState(0)
  const posRef = useRef(pos)
  const scroller = useRef<HTMLDivElement | null>(null)
  const carousel = useRef<HTMLDivElement | null>(null)
  const pauseReasons = useRef(new Set<string>())
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raf = useRef(0)
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoplayOn = config.autoplay && !manualPaused && !reducedMotion && slideCount > 1
  const slidesKey = slides.map((slide) => slide.id).join(',')
  posRef.current = pos

  function setPauseReason(reason: string, active: boolean) {
    const hadReason = pauseReasons.current.has(reason)
    if (active === hadReason) return
    if (active) pauseReasons.current.add(reason)
    else pauseReasons.current.delete(reason)
    setPauseVersion((value) => value + 1)
  }

  function goToSlide(index: number) {
    setPos(index)
    setAutoplayReset((value) => value + 1)
  }

  // Reset scroll + position when the enabled-slide set changes (clone math must never go stale)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = 0
    setPos(0)
  }, [slidesKey])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const update = () => setPauseReason('document', document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useEffect(() => {
    const element = carousel.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setPauseReason('viewport', !entry?.isIntersecting), { threshold: .15 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!autoplayOn || pauseReasons.current.size > 0) return
    const id = window.setTimeout(() => setPos((current) => Math.min(current + 1, slideCount)), config.interval)
    return () => window.clearTimeout(id)
  }, [autoplayOn, autoplayReset, config.interval, pauseVersion, pos, slideCount])

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
      if (safety.current) {
        clearTimeout(safety.current)
        safety.current = null
      }
      if (hasClone && pos >= slideCount) {
        snapToStart()
        return
      }
      const finalTarget = pos * el.clientWidth
      if (Math.abs(el.scrollLeft - finalTarget) > 2) el.scrollLeft = finalTarget
      programmatic.current = false
    }
    if (Math.abs(el.scrollLeft - target) < 4) {
      if (hasClone && pos >= slideCount) { programmatic.current = true; snapToStart() }
      return
    }
    programmatic.current = true

    if (reducedMotion) {
      el.scrollLeft = target
      finish()
      return
    }

    cancelAnimationFrame(raf.current)
    if (safety.current) {
      clearTimeout(safety.current)
      safety.current = null
    }
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
      safety.current = null
      cancelAnimationFrame(raf.current)
      if (Math.abs(el.scrollLeft - target) > 2) el.scrollLeft = target
      finish()
    }, dur + 120)
  }, [pos, hasClone, reducedMotion, slideCount])

  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const target = resolvePromoSliderResizeScrollLeft({
        programmatic: programmatic.current,
        position: posRef.current,
        slideCount,
        width: el.clientWidth,
      })
      if (target !== null) el.scrollLeft = target
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [slideCount])

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

  if (slideCount === 0) {
    if (!editorPreview) return null
    return (
      <div role="status" data-promo-slider-empty style={{ minHeight: 150, borderRadius: config.radius, border: '1px dashed var(--p-border)', background: 'var(--p-card)', color: 'var(--p-text-2)', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <span><strong style={{ display: 'block', color: 'var(--p-text)', fontSize: 14 }}>{t("Gösterilecek kampanya yok")}</strong><small style={{ display: 'block', marginTop: 5, fontSize: 11.5 }}>{t("Aktif bir kampanya ekleyin veya manuel kartları etkinleştirin.")}</small></span>
      </div>
    )
  }

  // indicators map over REAL slides only; while the clone is visible, highlight 0
  const displayIdx = pos % slideCount
  const renderSlides = [
    ...slides.map((slide, index) => ({ ...slide, index, clone: false })),
    ...(hasClone ? [{ id: `${slides[0]!.id}-clone`, node: slides[0]!.node, index: 0, clone: true }] : []),
  ]

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
        .garsonless-loyalty-card:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--p-accent) 34%, #fff);
          outline-offset: 3px;
        }
        html[data-focus-modality="keyboard"] [data-component="promo-flash-offer-panel"]:focus-within {
          border-color: var(--p-accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-accent) 18%, transparent) !important;
        }
        .garsonless-promo-flash-select:focus-visible {
          outline: none !important;
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
          .garsonless-promo-scroller { scroll-behavior: auto !important; }
          .garsonless-active-campaign-slide,
          .garsonless-promo-action,
          .garsonless-promo-indicator { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div
        ref={carousel}
        role="region"
        aria-roledescription="carousel"
        aria-label="Kampanyalar"
        onMouseEnter={() => setPauseReason('hover', true)}
        onMouseLeave={() => setPauseReason('hover', false)}
        onTouchStart={() => setPauseReason('touch', true)}
        onTouchEnd={() => setPauseReason('touch', false)}
        onTouchCancel={() => setPauseReason('touch', false)}
        onFocusCapture={() => setPauseReason('focus', true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPauseReason('focus', false)
        }}
      >
        <div
          ref={scroller}
          className="garsonless-promo-scroller"
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
          {renderSlides.map((slide) => {
            const active = !slide.clone && slide.index === displayIdx
            return (
            <div
              key={slide.id}
              role={slide.clone ? undefined : 'group'}
              aria-roledescription={slide.clone ? undefined : 'slayt'}
              aria-label={slide.clone ? undefined : `${slide.index + 1} / ${slideCount}`}
              aria-hidden={active ? undefined : true}
              inert={!active}
              style={{ minWidth: '100%', scrollSnapAlign: 'center' }}
            >
              {slide.node}
            </div>
          )})}
        </div>

        <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
          Slayt {displayIdx + 1} / {slideCount}
        </span>

        {slideCount > 1 && config.indicator === 'dots' && (
          <div aria-label={t("Slayt seçimi")} style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 2 }}>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className="garsonless-promo-indicator"
                aria-label={`Slayt ${i + 1}`}
                aria-current={i === displayIdx ? 'true' : undefined}
                onClick={() => goToSlide(i)}
                style={{
                  width: 44, height: 44, borderRadius: 99,
                  border: 'none', cursor: 'pointer', padding: 0, background: 'transparent',
                  display: 'grid', placeItems: 'center',
                }}
              ><span aria-hidden="true" style={{ width: i === displayIdx ? 20 : 6, height: 6, borderRadius: 99, background: i === displayIdx ? 'var(--p-accent)' : 'var(--p-border)', transition: reducedMotion ? 'none' : 'all 300ms' }} /></button>
            ))}
          </div>
        )}

        {slideCount > 1 && config.indicator === 'bars' && (
          <div aria-label={t("Slayt seçimi")} style={{ display: 'flex', gap: 0, marginTop: 2 }}>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className="garsonless-promo-indicator"
                aria-label={`Slayt ${i + 1}`}
                aria-current={i === displayIdx ? 'true' : undefined}
                onClick={() => goToSlide(i)}
                style={{ flex: 1, minWidth: 44, height: 44, padding: '20px 2px', border: 0, cursor: 'pointer', background: 'transparent' }}
              >
                <span aria-hidden="true" style={{
                  display: 'block', height: 4, borderRadius: 99, overflow: 'hidden',
                  background: 'var(--p-border)',
                }}><span style={{ display: 'block', height: '100%',
                  width: i <= displayIdx ? '100%' : '0%',
                  background: 'var(--p-accent)',
                  transition: reducedMotion ? 'none' : `width ${config.interval}ms linear`,
                }} /></span>
              </button>
            ))}
          </div>
        )}

        {autoplayOn || (config.autoplay && !reducedMotion && slideCount > 1) ? (
          <button
            type="button"
            className="garsonless-promo-action"
            aria-pressed={manualPaused}
            onClick={() => setManualPaused((value) => !value)}
            style={{ minHeight: 36, margin: '0 auto', padding: '0 12px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--p-text-2)', display: 'block', font: '700 11px var(--p-body)', cursor: 'pointer' }}
          >{t(manualPaused ? 'Otomatik oynat' : 'Otomatik oynatmayı durdur')}</button>
        ) : null}
      </div>
    </>
  )
}

const LEGACY_MANUAL_PREFIXES = ['coupon', 'flash', 'freebie', 'loyalty'] as const

function resolveSourceMode(config: Record<string, string>): PromoSliderConfig['sourceMode'] {
  if (config.sourceMode === 'active' || config.sourceMode === 'mixed' || config.sourceMode === 'manual') return config.sourceMode
  return Object.keys(config).some((key) => LEGACY_MANUAL_PREFIXES.some((prefix) => key.startsWith(prefix)))
    ? 'manual'
    : 'active'
}

function readAction(
  config: Record<string, string>,
  prefix: 'flash' | 'freebie' | 'loyalty',
  fallbackType: PromoSliderActionConfig['type'],
  fallbackText: string,
): PromoSliderActionConfig {
  const storedType = config[`${prefix}TargetType`]
  const type = storedType === 'category' || storedType === 'product' || storedType === 'cart' || storedType === 'member' || storedType === 'none'
    ? storedType
    : fallbackType
  return {
    type,
    ctaText: config[`${prefix}CtaText`]?.trim() || fallbackText,
    categoryId: config[`${prefix}CategoryId`]?.trim() || (prefix === 'freebie' ? config.freebieCategoryId?.trim() || '' : ''),
    productId: config[`${prefix}ProductId`]?.trim() || '',
  }
}

export function PromoSliderBlock({
  config,
  memberLoyalty,
  sectionInstanceId = 'promo-slider',
  activeCampaigns = [],
  items = [],
  onQuickAdd,
  onAddFreebie,
  onOpenCart,
  onOpenMember,
  onSelectCategory,
  editorPreview = false,
  restaurantName = 'masabu',
  restaurantLogoUrl = null,
  theme,
}: {
  config: Record<string, string>
  memberLoyalty?: {
    filled: number
    total: number
    points?: number
    pointsEnabled?: boolean
    stampsEnabled?: boolean
    tierName?: string
  } | null
  sectionInstanceId?: string
  activeCampaigns?: PromoSliderCampaign[]
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  onAddFreebie?: (campaign: FreebieAddRequest) => void
  onOpenCart?: () => void
  onOpenMember?: (target?: MemberOpenTarget) => void
  onSelectCategory?: (categoryId: string) => void
  renderContext?: 'menu' | 'catalog' | 'home'
  editorPreview?: boolean
  restaurantName?: string
  restaurantLogoUrl?: string | null
  theme?: PromoSliderTheme
}) {
  const { t } = useMenuLocale();
  const { text, number, bool } = useMenuReaders(config)
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
  const freebieStartsAt = Date.parse(text('freebieStartsAt', ''))
  const freebieEndsAt = Date.parse(text('freebieEndsAt', ''))
  const freebieOfferType = text('freebieOfferType', 'promo-only') === 'gift-with-purchase' ? 'gift-with-purchase' : 'promo-only'
  const freebieCtaText = text('freebieCtaText', '') || (freebieOfferType === 'gift-with-purchase' ? t("Kahveni ve hediyeni seç") : t("Menüye git →"))
  const legacySourceMode = resolveSourceMode(config)
  const legacySpecialCardsDefaultOn = legacySourceMode !== 'active'
  const cfg: PromoSliderConfig = {
    sourceMode: legacySourceMode,
    autoplay: bool('autoplay', true),
    interval: Math.max(1500, number('interval', 2800)),
    indicator: (text('indicator', 'dots') === 'bars' ? 'bars' : 'dots'),
    radius: number('radius', 16),
    coupon: {
      enabled: bool('couponEnabled', legacySpecialCardsDefaultOn) && Boolean(text('couponId', '')),
      eyebrow: text('couponEyebrow', t("İLK SİPARİŞE ÖZEL")),
      title: text('couponTitle', t("%25 İndirim")),
      subtitle: text('couponSubtitle', t("200₺ üzeri tüm siparişlerde geçerli")),
      code: text('couponCode', 'HOSGELDIN25'),
      bgStart: text('couponBgStart', '#a13b7a'),
      bgEnd: text('couponBgEnd', '#d4477f'),
      textColor: text('couponTextColor', '#ffffff'),
      accentColor: text('couponAccentColor', '#ffffff'),
      buttonBgColor: text('couponButtonBgColor', '#ffffff'),
      buttonTextColor: text('couponButtonTextColor', '#a13b7a'),
    },
    flash: {
      enabled: bool('flashEnabled', legacySpecialCardsDefaultOn),
      chip: text('flashChip', t("⚡ FLASH İNDİRİM")),
      title: text('flashTitle', t("Tatlılarda")),
      accentText: text('flashAccentText', t("2 al 1 öde")),
      countdownEnabled: flashCountdownEnabled,
      ...(flashExpiresAtMs !== undefined ? { expiresAtMs: flashExpiresAtMs } : {}),
      countdownLabel: text('flashCountdownLabel', t("Fırsat bitiyor")),
      bgStart: text('flashBgStart', '#13110f'),
      bgEnd: text('flashBgEnd', '#211a16'),
      textColor: text('flashTextColor', '#ffffff'),
      accentColor: text('flashAccentColor', '#ffd089'),
      offerType: text('flashOfferType', 'none') === 'buy-2-pay-1' ? 'buy-2-pay-1' : 'none',
      itemIds: [text('flashItem1Id', ''), text('flashItem2Id', ''), text('flashItem3Id', ''), text('flashItem4Id', '')].filter(Boolean),
      discountPolicy: text('flashDiscountPolicy', 'combine-loyalty') === 'promotion-only' ? 'promotion-only' : 'combine-loyalty',
      action: readAction(config, 'flash', 'none', 'Fırsatı gör'),
    },
    freebie: {
      enabled: bool('freebieEnabled', false),
      label: text('freebieLabel', t("Bugüne özel")),
      title: text('freebieTitle', t("Kahvenin yanında kurabiye bedava")),
      subtitle: text('freebieSubtitle', t("Her sıcak kahve siparişinde 🍪")),
      emoji: text('freebieEmoji', '🎁'),
      ctaText: freebieCtaText,
      categoryId: text('freebieCategoryId', ''),
      offerType: freebieOfferType,
      qualifierMode: text('freebieQualifierMode', 'category') === 'products' ? 'products' : 'category',
      qualifierCategoryId: text('freebieQualifierCategoryId', ''),
      qualifierItemIds: [1, 2, 3, 4].map((index) => text(`freebieQualifierItem${index}Id`, '')).filter(Boolean),
      rewardItemIds: [1, 2, 3, 4].map((index) => text(`freebieRewardItem${index}Id`, '')).filter(Boolean),
      timingEnabled: bool('freebieTimingEnabled', false),
      ...(Number.isFinite(freebieStartsAt) ? { startsAtMs: freebieStartsAt } : {}),
      ...(Number.isFinite(freebieEndsAt) ? { endsAtMs: freebieEndsAt } : {}),
      imageSource: ['custom', 'qualifier', 'reward', 'emoji', 'none'].includes(text('freebieImageSource', 'emoji')) ? text('freebieImageSource', 'emoji') as PromoFreebieConfig['imageSource'] : 'emoji',
      imageUrl: text('freebieImageUrl', ''),
      layout: ['media-right', 'split', 'cover'].includes(text('freebieLayout', 'media-right')) ? text('freebieLayout', 'media-right') as PromoFreebieConfig['layout'] : 'media-right',
      imageFit: text('freebieImageFit', 'cover') === 'contain' ? 'contain' : 'cover',
      imagePosition: text('freebieImagePosition', 'center') === 'top' ? 'top' : text('freebieImagePosition', 'center') === 'bottom' ? 'bottom' : 'center',
      bgStart: text('freebieBgStart', '#ffd089'),
      bgEnd: text('freebieBgEnd', '#ffb347'),
      textColor: text('freebieTextColor', '#5a2a14'),
      accentColor: text('freebieAccentColor', '#a13b7a'),
      buttonBgColor: text('freebieButtonBgColor', '#5a2a14'),
      buttonTextColor: text('freebieButtonTextColor', '#ffffff'),
      action: readAction(config, 'freebie', config.freebieCategoryId ? 'category' : 'none', freebieCtaText),
    },
    loyalty: {
      enabled: bool('loyaltyEnabled', false),
      eyebrow: text('loyaltyEyebrow', 'SADAKAT KARTI'),
      title: text('loyaltyTitle', '9 kahve al, 1 kahve bizden'),
      // Real member progress when logged in; configured demo values otherwise.
      filled: memberLoyalty ? memberLoyalty.filled : number('loyaltyFilled', 6),
      total: memberLoyalty ? memberLoyalty.total : number('loyaltyTotal', 10),
      points: memberLoyalty?.points ?? 0,
      pointsEnabled: memberLoyalty?.pointsEnabled ?? false,
      stampsEnabled: memberLoyalty?.stampsEnabled ?? true,
      tierName: memberLoyalty?.tierName ?? '',
      restaurantName,
      logoUrl: restaurantLogoUrl ?? '',
      authenticated: memberLoyalty != null,
      bgStart: text('loyaltyBgStart', '#2e7d63'),
      bgEnd: text('loyaltyBgEnd', '#1f6b53'),
      textColor: text('loyaltyTextColor', '#ffffff'),
      accentColor: text('loyaltyAccentColor', '#d7b06a'),
      action: {
        ...readAction(config, 'loyalty', 'member', memberLoyalty != null ? 'Kartımı gör' : 'Üye ol ve kazan'),
        type: 'member',
      },
    },
  }
  const campaigns = selectPromoSliderCampaigns(activeCampaigns, config.activeCampaignIds)

  return (
    <section id={`custom-section-${sectionInstanceId}`} className={tagShimmerScopeClass(theme)} data-component="custom-section" data-section-kind="promo-slider" style={customSectionShell}>
      <PromoSliderSection
        config={cfg}
        campaigns={campaigns}
        items={items}
        handlers={{
          ...(onQuickAdd ? { onQuickAdd } : {}),
          ...(onAddFreebie ? { onAddFreebie } : {}),
          ...(onOpenCart ? { onOpenCart } : {}),
          ...(onOpenMember ? { onOpenMember } : {}),
          ...(onSelectCategory ? { onSelectCategory } : {}),
        }}
        sectionInstanceId={sectionInstanceId}
        editorPreview={editorPreview}
      />
    </section>
  )
}
