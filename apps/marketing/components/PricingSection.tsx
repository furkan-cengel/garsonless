'use client'

import { useState } from 'react'
import { MI } from '../lib/icons'
import { SectionHead } from './ui/SectionHead'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const PLANS = [
  {
    id: 'free', name: 'Ücretsiz', price: 0, monthly: 0,
    desc: 'Küçük mekanlar için temel paket',
    cta: 'Hemen başla', highlight: false,
    features: [
      { text: '3 masaya kadar', on: true },
      { text: 'QR menü', on: true },
      { text: 'Sipariş alma', on: true },
      { text: 'Temel raporlar', on: true },
      { text: 'Tema özelleştirme', on: false },
      { text: 'Çoklu mağaza', on: false },
      { text: 'API erişimi', on: false },
    ],
  },
  {
    id: 'pro', name: 'Pro', price: 899, monthly: 1099,
    desc: 'Büyüyen restoranlar için',
    cta: '14 gün ücretsiz dene', highlight: true, badge: 'En popüler',
    features: [
      { text: '50 masaya kadar', on: true },
      { text: 'QR + menü + sipariş', on: true },
      { text: 'Mutfak/Bar ekranı', on: true },
      { text: 'Tüm raporlar + AI içgörü', on: true },
      { text: 'Tam tema özelleştirme', on: true },
      { text: "Çoklu mağaza (3'e kadar)", on: true },
      { text: 'Öncelikli destek', on: true },
    ],
  },
  {
    id: 'business', name: 'Business', price: 'Özel' as const, monthly: 'Özel' as const,
    desc: 'Zincir & franchise için',
    cta: 'Bizimle konuş', highlight: false,
    features: [
      { text: 'Sınırsız masa & mağaza', on: true },
      { text: "Pro'nun tüm özellikleri", on: true },
      { text: 'API + Webhooks', on: true },
      { text: 'SSO & merkezi yönetim', on: true },
      { text: 'Beyaz etiket seçeneği', on: true },
      { text: 'Özel SLA + 7/24 destek', on: true },
      { text: 'Adanmış hesap yöneticisi', on: true },
    ],
  },
]

function PriceCard({ plan, yearly }: { plan: typeof PLANS[0]; yearly: boolean }) {
  const price = yearly ? plan.price : plan.monthly
  const isFree = plan.id === 'free'
  const isBusiness = plan.id === 'business'

  return (
    <article style={{
      background: plan.highlight ? 'var(--night)' : 'var(--surface)',
      color: plan.highlight ? '#fff' : 'var(--ink)',
      borderRadius: 20, padding: 32,
      border: plan.highlight ? '1px solid var(--night)' : '1px solid var(--line)',
      position: 'relative',
      ...(plan.highlight ? {
        transform: 'translateY(-12px)',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,.3), 0 0 0 1px rgba(255,208,137,.2) inset',
        overflow: 'hidden',
      } : {}),
    }}>
      {plan.highlight && <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.18), transparent 65%)' }} />}
      {'badge' in plan && plan.badge && (
        <span style={{ position: 'absolute', top: 16, right: 16, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-2)', color: 'var(--ink)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{plan.badge}</span>
      )}
      <div style={{ position: 'relative' }}>
        <h3 className="font-display" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', margin: 0, color: plan.highlight ? 'var(--accent-2)' : 'var(--ink)' }}>{plan.name}</h3>
        <p style={{ fontSize: 13.5, color: plan.highlight ? 'rgba(255,255,255,.6)' : 'var(--ink-3)', marginTop: 6 }}>{plan.desc}</p>
        <div style={{ margin: '24px 0 4px', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {isBusiness ? (
            <span className="font-display" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.02em' }}>Özel teklif</span>
          ) : (
            <>
              <span className="font-display" style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>
                ₺{isFree ? '0' : typeof price === 'number' ? price.toLocaleString('tr-TR') : price}
              </span>
              <span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,.55)' : 'var(--ink-3)' }}>/ay</span>
            </>
          )}
        </div>
        {!isFree && !isBusiness && yearly && typeof plan.price === 'number' && typeof plan.monthly === 'number' && (
          <div style={{ fontSize: 12, color: 'var(--positive)', fontWeight: 600 }}>
            ₺{plan.monthly}/ay yerine — ₺{(plan.monthly - plan.price) * 12}/yıl tasarruf
          </div>
        )}
        <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none', display: 'block', marginTop: 24 }}>
          <button style={{
            width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 600,
            background: plan.highlight ? 'var(--accent-2)' : isFree ? 'transparent' : 'var(--ink)',
            color: plan.highlight ? 'var(--ink)' : isFree ? 'var(--ink)' : '#fff',
            border: isFree ? '1.5px solid var(--ink)' : 'none',
            borderRadius: 999, cursor: 'pointer',
          }}>{plan.cta}</button>
        </a>
        <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plan.features.map((f, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: f.on ? (plan.highlight ? '#fff' : 'var(--ink)') : (plan.highlight ? 'rgba(255,255,255,.35)' : 'var(--ink-4)') }}>
              <span style={{ color: f.on ? (plan.highlight ? 'var(--accent-2)' : 'var(--positive)') : 'currentColor', marginTop: 2 }}>
                {f.on ? <MI.check size={14} /> : <MI.x size={14} />}
              </span>
              <span style={{ lineHeight: 1.45, ...(!f.on ? { textDecoration: 'line-through', opacity: .7 } : {}) }}>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function PricingSection() {
  const [yearly, setYearly] = useState(true)

  return (
    <section id="fiyatlandırma" style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div className="container">
        <SectionHead
          eyebrow="Fiyatlandırma"
          title={<>Her şey dahil. <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>Sürpriz yok.</em></>}
          sub="Sipariş başı komisyon yok. Ücretsiz başla, dilediğinde yükselt."
        />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--bg-2)', borderRadius: 999, border: '1px solid var(--line)' }}>
            <button onClick={() => setYearly(false)} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: !yearly ? 'var(--ink)' : 'transparent', color: !yearly ? '#fff' : 'var(--ink-2)', border: 'none', borderRadius: 999 }}>Aylık</button>
            <button onClick={() => setYearly(true)} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: yearly ? 'var(--ink)' : 'transparent', color: yearly ? '#fff' : 'var(--ink-2)', border: 'none', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Yıllık
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--accent-2)', color: 'var(--ink)' }}>−%18</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
          {PLANS.map((p) => <PriceCard key={p.id} plan={p} yearly={yearly} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--ink-3)' }}>
          Tüm planlar 14 gün ücretsiz · KDV dahil · Kart gerekmez
        </div>
      </div>
    </section>
  )
}
