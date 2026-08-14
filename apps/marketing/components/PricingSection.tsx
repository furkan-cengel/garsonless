'use client'

import { useState } from 'react'
import {
  PLAN_PRICES,
  type BillingInterval,
  type SelfServePlan,
} from '@garsonless/domain/entitlements'
import { MI } from '../lib/icons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'
const FEATURE_PREVIEW_COUNT = 4

type PlanCard = {
  id: SelfServePlan | 'business'
  name: string
  description: string
  highlight?: boolean
  features: string[]
}

const PLANS: PlanCard[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Dijital menüyle başlayın.',
    features: ['Sınırsız ürün ve kategori', 'QR menü ve zengin ürün içeriği', 'Logo, renk, tipografi ve kart düzenleri'],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Masa ve adisyon operasyonu.',
    features: [
      'Starter’daki her şey',
      'Masa bazlı QR ve QR Studio',
      'Personel siparişi, adisyon ve tahsilat',
      'Temel satış, ürün, masa ve ödeme raporları',
      'Ekip ve yetkilendirme',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Siparişten sadakate tam operasyon.',
    highlight: true,
    features: [
      'Plus’taki her şey',
      'Müşteri sepeti ve QR siparişi',
      'Servis çağrısı, KDS ve istasyonlar',
      'Online ödeme ve hesap bölüşme',
      'Müşteri hesabı, CRM, sadakat ve kampanyalar',
      'Gelişmiş raporlar ve bildirimler',
      'Gelişmiş tema bölümleri ve video',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Çok şubeli işletmeler için.',
    features: ['Pro’daki her şey', 'Organizasyon ve ortak ekip erişimi', 'Güvenli şube geçişi', 'Satış destekli kurulum'],
  },
]

function money(minor: number, digits = 0): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(minor / 100)
}

function PriceCard({ plan, interval }: { plan: PlanCard; interval: BillingInterval }) {
  const [expanded, setExpanded] = useState(false)
  const isBusiness = plan.id === 'business'
  const price = plan.id === 'business' ? null : PLAN_PRICES[plan.id][interval]
  const monthlyEquivalent = price && interval === 'annual' ? Math.round(price.amountMinor / 12) : price?.amountMinor
  const hiddenFeatureCount = Math.max(plan.features.length - FEATURE_PREVIEW_COUNT, 0)
  const visibleFeatures = expanded ? plan.features : plan.features.slice(0, FEATURE_PREVIEW_COUNT)
  const featureListId = `pricing-${plan.id}-features`
  const billingMeta = isBusiness
    ? 'Şube sayınıza göre özel fiyatlandırma'
    : interval === 'annual' && price
      ? `Yıllık peşin ${money(price.amountMinor, 2)}`
      : null
  const href = isBusiness
    ? '/company?subject=business#iletişim'
    : `${DASHBOARD_URL}/auth/signup?plan=${plan.id}`

  return (
    <article className={`pricing-card${plan.highlight ? ' pricing-card--highlight' : ''}`}>
      <div className="pricing-card__summary">
        <div className="pricing-card__head">
          <h3>{plan.name}</h3>
          {plan.highlight && <span className="pricing-badge">En çok tercih edilen</span>}
        </div>
        <p className="pricing-description">{plan.description}</p>
        <div className="pricing-price">
          {isBusiness ? 'Özel teklif' : <>{money(monthlyEquivalent ?? 0, interval === 'annual' ? 2 : 0)}<small>/ay</small></>}
        </div>
        <div className="pricing-billing-meta">{billingMeta}</div>
        <a className="pricing-cta" href={href}>{isBusiness ? 'Bizimle konuş' : '14 gün ücretsiz dene'}</a>
      </div>

      <div className="pricing-features">
        <h4>Paket kapsamında</h4>
        <ul id={featureListId}>
          {visibleFeatures.map((feature) => (
            <li key={feature}>
              <span className="pricing-feature-check" aria-hidden="true"><MI.check size={11} /></span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        {hiddenFeatureCount > 0 && (
          <button
            className="pricing-more"
            type="button"
            aria-expanded={expanded}
            aria-controls={featureListId}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Daha az göster' : `Daha fazla göster (${hiddenFeatureCount})`}
            <MI.chevDown size={14} />
          </button>
        )}
      </div>
    </article>
  )
}

export function PricingSection() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <section id="fiyatlandırma" className="pricing-section story-section">
      <div className="story-container">
        <div className="pricing-heading">
          <h2 className="font-display">Fiyatlandırma</h2>
          <div className="pricing-toolbar">
            <div className="pricing-toggle" role="group" aria-label="Faturalandırma dönemi">
              <button type="button" aria-pressed={interval === 'monthly'} onClick={() => setInterval('monthly')}>Aylık</button>
              <button type="button" aria-pressed={interval === 'annual'} onClick={() => setInterval('annual')}>Yıllık <span>%20 indirim</span></button>
            </div>
            <p>KDV dâhil · Sipariş komisyonu yok · Starter, Plus ve Pro’da taahhüt yok</p>
          </div>
        </div>

        <div className="pricing-grid">
          {PLANS.map((plan) => <PriceCard key={plan.id} plan={plan} interval={interval} />)}
        </div>
      </div>
      <style jsx global>{`
        .pricing-section { padding: 84px 0 96px; overflow: hidden; }
        .pricing-heading { margin-bottom: 34px; }
        .pricing-heading h2 { margin: 0; font-size: clamp(44px, 5.2vw, 66px); font-weight: 500; letter-spacing: -.04em; line-height: 1.02; }
        .pricing-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 38px; }
        .pricing-toolbar > p { margin: 0; color: var(--story-muted); font-size: 12px; line-height: 1.5; text-align: right; }
        .pricing-toggle { display: flex; width: fit-content; flex: 0 0 auto; padding: 3px; border: 1px solid #aeb4b1; border-radius: 999px; background: var(--story-surface); }
        .pricing-toggle button { min-height: 34px; padding: 7px 15px; border: 0; border-radius: 999px; color: var(--story-text); background: transparent; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
        .pricing-toggle button[aria-pressed="true"] { background: var(--story-green-soft); }
        .pricing-toggle span { margin-left: 4px; color: var(--story-green-dark); font-size: 10px; }
        .pricing-toggle button:focus-visible, .pricing-cta:focus-visible, .pricing-more:focus-visible { outline: 3px solid color-mix(in srgb, var(--story-green) 35%, transparent); outline-offset: 3px; }
        .pricing-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 16px; align-items: stretch; }
        .pricing-card { display: flex; min-width: 0; flex-direction: column; padding: 26px 23px 24px; color: var(--story-text); background: var(--story-surface); border: 1px solid #cfd3d1; border-radius: 18px; }
        .pricing-card--highlight { border-color: var(--story-green-dark); }
        .pricing-card__summary { display: flex; min-height: 238px; flex-direction: column; }
        .pricing-card__head { display: flex; min-height: 30px; align-items: center; justify-content: space-between; gap: 8px; }
        .pricing-badge { flex: 0 0 auto; padding: 4px 7px; border-radius: 999px; color: var(--story-green-dark); background: var(--story-green-soft); font-size: 9px; font-weight: 750; white-space: nowrap; }
        .pricing-card h3 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.025em; }
        .pricing-description { min-height: 42px; margin: 5px 0 0; color: var(--story-muted); font-size: 12.5px; line-height: 1.45; }
        .pricing-price { min-height: 39px; margin-top: 20px; font-size: 31px; font-weight: 700; letter-spacing: -.045em; line-height: 1.08; }
        .pricing-price small { margin-left: 4px; color: var(--story-muted); font-size: 11px; font-weight: 550; letter-spacing: 0; }
        .pricing-billing-meta { min-height: 18px; margin-top: 5px; color: var(--story-muted); font-size: 10.5px; font-weight: 600; line-height: 1.35; }
        .pricing-cta { display: flex; min-height: 41px; align-items: center; justify-content: center; margin-top: auto; padding: 9px 12px; border: 1px solid var(--story-text); border-radius: 999px; color: var(--story-text); background: transparent; text-align: center; text-decoration: none; font-size: 12px; font-weight: 700; transition: color 160ms ease, background-color 160ms ease; }
        .pricing-cta:hover { color: #fff; background: var(--story-text); }
        .pricing-card--highlight .pricing-cta { color: #fff; background: var(--story-text); }
        .pricing-card--highlight .pricing-cta:hover { background: var(--story-green-dark); border-color: var(--story-green-dark); }
        .pricing-features { margin-top: 25px; padding-top: 21px; border-top: 1px solid var(--story-line); }
        .pricing-features h4 { margin: 0 0 12px; font-size: 12px; font-weight: 750; }
        .pricing-features ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
        .pricing-features li { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.42; }
        .pricing-feature-check { display: inline-grid; width: 17px; height: 17px; flex: 0 0 17px; place-items: center; margin-top: 1px; border-radius: 999px; color: #fff; background: var(--story-text); }
        .pricing-feature-check svg { display: block; }
        .pricing-more { display: inline-flex; align-items: center; gap: 5px; margin-top: 15px; padding: 0; border: 0; color: var(--story-green-dark); background: transparent; font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; }
        .pricing-more svg { transition: transform 160ms ease; }
        .pricing-more[aria-expanded="true"] svg { transform: rotate(180deg); }
        @media (max-width: 1024px) { .pricing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) {
          .pricing-section { padding-block: 80px; }
          .pricing-toolbar { align-items: flex-start; flex-direction: column; gap: 16px; }
          .pricing-toolbar > p { max-width: 560px; text-align: left; }
        }
        @media (max-width: 640px) {
          .pricing-section { padding-block: 72px; }
          .pricing-heading { margin-bottom: 28px; }
          .pricing-heading h2 { font-size: clamp(42px, 12vw, 54px); }
          .pricing-toolbar { margin-top: 28px; }
          .pricing-toggle { width: 100%; }
          .pricing-toggle button { flex: 1; padding-inline: 10px; }
          .pricing-grid { grid-template-columns: 1fr; gap: 14px; }
          .pricing-card { padding: 26px 22px; }
          .pricing-card__summary { min-height: 222px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pricing-cta, .pricing-more svg { transition: none; }
        }
      `}</style>
    </section>
  )
}
