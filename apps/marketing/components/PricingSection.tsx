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
    </section>
  )
}
