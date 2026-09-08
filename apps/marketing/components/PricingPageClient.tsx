'use client'

import { useState } from 'react'
import { ADD_ON_PRICES, PLAN_PRICES, type BillingInterval } from '@garsonless/domain/entitlements'
import { MI } from '../lib/icons'
import {
  MARKETING_PLANS,
  PRICING_COMPARISON_GROUPS,
  PRICING_FAQS,
  comparisonValues,
  type ComparisonValue,
  type MarketingPlanId,
} from '../lib/pricing-catalog'
import { PricingIntervalToggle, PricingPlanCards, pricingMoney } from './PricingSection'
import { FAQAccordion } from './FAQAccordion'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

function planPrice(plan: MarketingPlanId, interval: BillingInterval): string {
  if (plan === 'business') return 'Özel teklif'
  const price = PLAN_PRICES[plan][interval]
  const displayed = interval === 'annual' ? Math.round(price.amountMinor / 12) : price.amountMinor
  return `${pricingMoney(displayed, interval === 'annual' ? 2 : 0)}/ay`
}

function ComparisonCell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return <span className="pricing-compare-check" aria-label="Dâhil"><MI.check size={13} /></span>
  }
  if (value === false) {
    return <span className="pricing-compare-empty" aria-label="Dâhil değil">-</span>
  }
  return <span className="pricing-compare-value">{value}</span>
}

export function PricingPageClient() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const addOnPrice = ADD_ON_PRICES.iyzico_online_payments[interval]
  const addOnDisplayMinor = interval === 'annual' ? Math.round(addOnPrice.amountMinor / 12) : addOnPrice.amountMinor
  const [openGroups, setOpenGroups] = useState<string[]>(() => PRICING_COMPARISON_GROUPS.map((group) => group.id))

  const toggleGroup = (id: string) => {
    setOpenGroups((current) => current.includes(id)
      ? current.filter((groupId) => groupId !== id)
      : [...current, id])
  }

  return (
    <div className="pricing-page story-section">
      <header className="pricing-page-hero">
        <div className="story-container">
          <div className="pricing-page-hero__heading">
            <span>Fiyatlandırma</span>
            <h1 className="font-display">İşletmenize uyan planı seçin.</h1>
            <p>14 gün boyunca Pro’yu deneyin. Kart gerekmez; Starter, Plus ve Pro’da taahhüt yoktur.</p>
          </div>

          <div className="pricing-page-toolbar">
            <PricingIntervalToggle interval={interval} onChange={setInterval} />
            <p>KDV hariç · Sipariş komisyonu yok · Yıllık ödemede %20 indirim</p>
          </div>

          <PricingPlanCards interval={interval} />

          <aside className="pricing-addon" aria-label="Pro add-on">
            <div>
              <span className="pricing-addon__eyebrow">Pro’ya özel add-on</span>
              <h3>İyzico Online Ödeme</h3>
              <p>Add-on fiyatı, KDV ve ödenecek genel toplam Dashboard’daki güvenli satın alma özetinde ayrı kalem olarak gösterilir.</p>
            </div>
            <div className="pricing-addon__meta"><strong>+{pricingMoney(addOnDisplayMinor)}/ay</strong><span>{interval === 'annual' ? `Yıllık peşin ${pricingMoney(addOnPrice.amountMinor)}` : 'Yalnız Pro ile'} · KDV hariç</span></div>
          </aside>

          <a className="pricing-page-jump" href="#paket-karsilastirma">
            Paketleri ayrıntılı karşılaştır <MI.arrow size={16} />
          </a>
        </div>
      </header>

      <section id="paket-karsilastirma" className="pricing-comparison-section">
        <div className="story-container">
          <div className="pricing-page-section-heading">
            <div>
              <span>Paket karşılaştırması</span>
              <h2 className="font-display">Her özelliği yan yana görün.</h2>
            </div>
            <p>Yalnız bugün sunulan veya paket kapsamında açıkça tanımlanan özellikler listelenir.</p>
          </div>

          <div className="pricing-comparison-scroll" tabIndex={0} role="region" aria-label="Paket özellikleri karşılaştırma tablosu">
            <table className="pricing-comparison-table">
              <caption className="sr-only">Starter, Plus, Pro ve Business planlarının ayrıntılı özellik karşılaştırması</caption>
              <thead>
                <tr>
                  <th scope="col">Özellik</th>
                  {MARKETING_PLANS.map((plan) => {
                    const href = plan.id === 'business'
                      ? '/iletisim?subject=business#satis-formu'
                      : `${DASHBOARD_URL}/auth/signup?plan=${plan.id}&interval=${interval === 'annual' ? 'yearly' : 'monthly'}`
                    return (
                      <th scope="col" key={plan.id} className={plan.highlight ? 'is-highlighted' : undefined}>
                        <strong>{plan.name}</strong>
                        <span>{planPrice(plan.id, interval)}</span>
                        <a href={href}>{plan.id === 'business' ? 'Görüşelim' : 'Ücretsiz dene'}</a>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              {PRICING_COMPARISON_GROUPS.map((group) => {
                const open = openGroups.includes(group.id)
                return (
                  <tbody key={group.id}>
                    <tr className="pricing-comparison-group">
                      <th colSpan={5} scope="colgroup">
                        <button type="button" aria-expanded={open} onClick={() => toggleGroup(group.id)}>
                          <span><strong>{group.title}</strong><small>{group.description}</small></span>
                          <span>{open ? 'Gizle' : 'Göster'} <MI.chevDown size={15} /></span>
                        </button>
                      </th>
                    </tr>
                    {open && group.rows.map((row) => {
                      const values = comparisonValues(row)
                      return <tr key={row.feature}>
                        <th scope="row">
                          {row.feature}
                          {row.note && <small>{row.note}</small>}
                        </th>
                        {MARKETING_PLANS.map((plan) => (
                          <td key={plan.id} className={plan.highlight ? 'is-highlighted' : undefined}>
                            <ComparisonCell value={values[plan.id]} />
                          </td>
                        ))}
                      </tr>
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>

          <div className="pricing-comparison-mobile" aria-label="Mobil paket özellikleri karşılaştırması">
            {PRICING_COMPARISON_GROUPS.map((group) => {
              const open = openGroups.includes(group.id)
              return (
                <section className="pricing-comparison-mobile__group" key={group.id}>
                  <button
                    className="pricing-comparison-mobile__heading"
                    type="button"
                    aria-expanded={open}
                    aria-controls={`mobile-pricing-group-${group.id}`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span><strong>{group.title}</strong><small>{group.description}</small></span>
                    <span>{open ? 'Gizle' : 'Göster'} <MI.chevDown size={15} /></span>
                  </button>

                  {open && (
                    <div
                      id={`mobile-pricing-group-${group.id}`}
                      className="pricing-comparison-mobile__scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={`${group.title} paket karşılaştırması`}
                    >
                      <table>
                        <caption className="sr-only">{group.title} özelliklerinin paketlere göre karşılaştırması</caption>
                        <thead>
                          <tr>
                            <th scope="col">Özellik</th>
                            {MARKETING_PLANS.map((plan) => (
                              <th scope="col" key={plan.id} className={plan.highlight ? 'is-highlighted' : undefined}>
                                <strong>{plan.name}</strong>
                                <span>{planPrice(plan.id, interval)}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => {
                            const values = comparisonValues(row)
                            return <tr key={row.feature}>
                              <th scope="row">
                                {row.feature}
                                {row.note && <small>{row.note}</small>}
                              </th>
                              {MARKETING_PLANS.map((plan) => (
                                <td key={plan.id} className={plan.highlight ? 'is-highlighted' : undefined}>
                                  <ComparisonCell value={values[plan.id]} />
                                </td>
                              ))}
                            </tr>
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <p className="pricing-comparison-note">
            Online ödeme ve özel entegrasyonlar ilgili sağlayıcı kurulumu ile ticari koşullara tabidir. API, webhook, SSO, white-label, merkezi raporlama ve merkezi menü/fiyat senkronu paket kapsamında vaat edilmez.
          </p>
        </div>
      </section>

      <section className="pricing-page-faq">
        <div className="story-container story-container--narrow">
          <div className="pricing-page-section-heading">
            <div>
              <span>Fiyatlandırma SSS</span>
              <h2 className="font-display">Karar vermeden önce.</h2>
            </div>
            <p>Deneme, vergi, iptal ve Business kapsamıyla ilgili kısa cevaplar.</p>
          </div>
          <FAQAccordion items={PRICING_FAQS} />
        </div>
      </section>
    </div>
  )
}
