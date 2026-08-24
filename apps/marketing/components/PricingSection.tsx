'use client'

import { useState } from 'react'
import {
  PLAN_PRICES,
  type BillingInterval,
} from '@garsonless/domain/entitlements'
import { MI } from '../lib/icons'
import { MARKETING_PLANS, type MarketingPlan } from '../lib/pricing-catalog'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'
const FEATURE_PREVIEW_COUNT = 4

export function pricingMoney(minor: number, digits = 0): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(minor / 100)
}

function PriceCard({ plan, interval }: { plan: MarketingPlan; interval: BillingInterval }) {
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
      ? `Yıllık peşin ${pricingMoney(price.amountMinor, 2)}`
      : null
  const href = isBusiness
    ? '/iletisim?subject=business#satis-formu'
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
          {isBusiness ? 'Özel teklif' : <>{pricingMoney(monthlyEquivalent ?? 0, interval === 'annual' ? 2 : 0)}<small>/ay</small></>}
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

export function PricingIntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval
  onChange: (interval: BillingInterval) => void
}) {
  return (
    <div className="pricing-toggle" role="group" aria-label="Faturalandırma dönemi">
      <button type="button" aria-pressed={interval === 'monthly'} onClick={() => onChange('monthly')}>Aylık</button>
      <button type="button" aria-pressed={interval === 'annual'} onClick={() => onChange('annual')}>Yıllık <span>%20 indirim</span></button>
    </div>
  )
}

export function PricingPlanCards({ interval }: { interval: BillingInterval }) {
  return (
    <div className="pricing-grid">
      {MARKETING_PLANS.map((plan) => <PriceCard key={plan.id} plan={plan} interval={interval} />)}
    </div>
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
            <PricingIntervalToggle interval={interval} onChange={setInterval} />
            <p>KDV hariç · Sipariş komisyonu yok · Starter, Plus ve Pro’da taahhüt yok</p>
          </div>
        </div>

        <PricingPlanCards interval={interval} />
        <aside className="pricing-addon" aria-label="Pro add-on">
          <div>
            <span className="pricing-addon__eyebrow">Pro’ya özel add-on</span>
            <h3>İyzico Online Ödeme</h3>
            <p>QR menüde kartla ödeme ve online tahsilat akışını açar. Add-on fiyatı, KDV ve genel toplam satın alma özetinde ayrı kalem olarak gösterilir.</p>
          </div>
          <div className="pricing-addon__meta">
            <strong>Ayrıca fiyatlanır</strong>
            <span>Yalnız Pro ile · İyzico işlem ücretleri hariç</span>
          </div>
        </aside>
        <a className="pricing-detail-link" href="/fiyatlar">
          Tüm paketleri ve özellikleri karşılaştır <MI.arrow size={16} />
        </a>
      </div>
    </section>
  )
}
