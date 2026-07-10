import { MI } from '../lib/icons'
import { PrimaryButton, GhostButton } from './ui/Buttons'
import { Eyebrow } from './ui/Eyebrow'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

function HeroVisual() {
  return (
    <div className="marketing-hero__visual" style={{ position: 'relative', height: 580 }}>
      {/* Dashboard window — back */}
      <div className="marketing-hero__dashboard" style={{
        position: 'absolute', right: 0, top: 40,
        width: 540, background: 'var(--surface)',
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid var(--line)',
        boxShadow: '0 30px 80px -20px rgba(28,24,20,.25), 0 4px 12px rgba(28,24,20,.08)',
        transform: 'rotate(2deg)',
      }}>
        <div style={{ height: 32, background: '#f6f1e8', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />
          ))}
          <span style={{ marginLeft: 14, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--ink-3)' }}>maf-cafe.masabu.co/pano</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Bugünkü ciro', value: '₺18.420', d: '+24%', dark: true },
              { label: 'Sipariş',      value: '142',     d: '+18' },
              { label: 'Ort. sepet',   value: '₺129',    d: '-2%' },
            ].map((k, i) => (
              <div key={i} style={{
                padding: 11, borderRadius: 9,
                background: k.dark ? 'var(--night)' : 'var(--bg-2)',
                color: k.dark ? '#fff' : 'var(--ink)',
                position: 'relative', overflow: 'hidden',
              }}>
                {k.dark && <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: 'radial-gradient(circle, rgba(255,208,137,.2), transparent 60%)' }} />}
                <div style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 700, marginTop: 3, color: k.dark ? 'var(--accent-2)' : 'var(--ink)' }}>{k.value}</div>
                <div style={{ fontSize: 9.5, marginTop: 2, color: k.dark ? '#5ee8a4' : 'var(--positive)', fontWeight: 600 }}>↑ {k.d}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-2)', borderRadius: 9, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Saatlik akış · bugün</div>
            <svg viewBox="0 0 320 60" width="100%" style={{ display: 'block' }}>
              {[12,22,32,40,54,72,86,68,42,32,46,64,80,70,46,32].map((h, i) => (
                <rect key={i} x={i * 19 + 2} y={86 - h} width="14" height={h} rx="2"
                  fill={i === 10 ? '#ffd089' : 'var(--ink)'}
                  opacity={i === 10 ? 1 : 0.85}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Phone — front */}
      <div className="marketing-hero__phone" style={{
        position: 'absolute', left: 10, top: 0,
        width: 230, height: 470,
        borderRadius: 32, background: '#0b0a08',
        padding: 8,
        boxShadow: '0 40px 100px -25px rgba(28,24,20,.35), 0 0 0 .5px #0b0a08',
        transform: 'rotate(-4deg)',
        animation: 'float 5s ease-in-out infinite',
        zIndex: 2,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 25, overflow: 'hidden',
          background: '#fdfaf5', position: 'relative',
        }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
            <span>9:41</span>
            <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ width: 16, height: 8, borderRadius: 2, border: '1.2px solid currentColor', position: 'relative' }}>
                <span style={{ position: 'absolute', inset: 1, background: 'currentColor', borderRadius: 1, width: '70%' }} />
              </span>
            </span>
          </div>
          <div style={{ padding: '4px 14px 10px' }}>
            <div className="font-script" style={{ fontSize: 22, color: 'var(--brand)', lineHeight: 1 }}>Acımarka</div>
            <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--positive)' }} />
              Masa 5 · Açık
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '0 14px 10px', overflow: 'hidden' }}>
            {['Kahvaltı', 'Kahveler', 'Tatlılar'].map((c, i) => (
              <span key={c} style={{
                fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 999, flexShrink: 0,
                background: i === 0 ? 'var(--brand)' : 'transparent',
                color: i === 0 ? '#fff' : 'var(--ink-3)',
                border: i === 0 ? 'none' : '1px solid var(--line)',
              }}>{c}</span>
            ))}
          </div>
          <div className="font-script" style={{ fontSize: 18, color: 'var(--brand)', padding: '0 14px 8px', lineHeight: 1 }}>Kahvaltı</div>
          <div style={{ padding: '0 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { tint: '#fce8d3', emoji: '🍳', name: 'Serpme',  price: '₺380', tag: 'Pop.' },
              { tint: '#dcf0e1', emoji: '🥑', name: 'Avokado', price: '₺220', tag: 'Yeni' },
              { tint: '#fde7c2', emoji: '🍅', name: 'Menemen', price: '₺180' },
              { tint: '#fbd3c1', emoji: '🍳', name: 'Sahanda', price: '₺140' },
            ].map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(15,17,21,.04)', overflow: 'hidden' }}>
                <div style={{ height: 36, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, position: 'relative' }}>
                  {p.emoji}
                  {p.tag && <span style={{ position: 'absolute', top: 3, left: 3, background: '#fff', color: 'var(--brand)', fontSize: 6.5, fontWeight: 700, padding: '1.5px 4px', borderRadius: 999 }}>{p.tag}</span>}
                </div>
                <div style={{ padding: '5px 6px 6px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--brand)', fontSize: 9 }}>{p.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 9 }}>{p.price}</span>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: '#7eb928', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            position: 'absolute', left: 12, right: 12, bottom: 18,
            background: 'var(--ink)', color: '#fff', borderRadius: 11,
            padding: '8px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: 11 }}>🛒 Sepeti gör</span>
            <span style={{ fontWeight: 700, fontSize: 11 }}>₺780</span>
          </div>
        </div>
      </div>

      {/* Floating QR badge */}
      <div className="marketing-hero__qr" style={{
        position: 'absolute', left: 200, top: 360,
        width: 88, height: 88, borderRadius: 12,
        background: '#fff', padding: 10,
        boxShadow: '0 20px 50px -10px rgba(28,24,20,.25)',
        transform: 'rotate(8deg)',
        animation: 'float 6s ease-in-out infinite',
        animationDelay: '0.5s',
        zIndex: 3,
      }}>
        <svg viewBox="0 0 14 14" style={{ width: '100%', height: '100%' }}>
          <rect x="0" y="0" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="1" y="1" width="2" height="2" fill="#fff" />
          <rect x="10" y="0" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="11" y="1" width="2" height="2" fill="#fff" />
          <rect x="0" y="10" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="1" y="11" width="2" height="2" fill="#fff" />
          {[[5,1],[6,2],[7,1],[8,3],[5,3],[7,5],[9,5],[5,5],[6,7],[8,7],[10,6],[11,8],[5,8],[7,9],[9,11],[11,11],[5,11],[7,12],[10,10]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="1.4" height="1.4" rx=".3" fill="var(--ink)" />
          ))}
        </svg>
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="grain" style={{ position: 'relative', overflow: 'hidden', padding: '64px 0 120px' }}>
      <div style={{
        position: 'absolute', top: -100, right: -150,
        width: 540, height: 540, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,.18), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -120, left: -120,
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(161,59,122,.14), transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="container marketing-hero__grid" style={{
        display: 'grid', gridTemplateColumns: '1.05fr 1fr',
        gap: 56, alignItems: 'center', position: 'relative',
      }}>
        <div className="marketing-hero__copy">
          <Eyebrow tone="ink">Yeni · Sesli sipariş AI</Eyebrow>

          <h1 className="font-display" style={{
            fontSize: 'clamp(48px, 6.2vw, 84px)', fontWeight: 500,
            letterSpacing: '-0.035em', lineHeight: 0.98,
            margin: '24px 0 0', color: 'var(--ink)',
          }}>
            Kafeniz, garson<br />
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontStyle: 'italic', color: 'var(--brand)' }}>beklemeden</span>
              <svg viewBox="0 0 280 14" style={{ position: 'absolute', left: 0, bottom: -8, width: '100%', height: 12 }}>
                <path d="M3 8 Q 70 2 140 7 T 277 6" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>{' '}işliyor.
          </h1>

          <p style={{
            fontSize: 19, color: 'var(--ink-2)', lineHeight: 1.5,
            margin: '32px 0 0', maxWidth: 520,
          }}>
            Müşterileriniz QR&apos;ı tarar, menüden sipariş verir, ödeme yapar. Siz de mutfakta olan biteni tek ekrandan yönetirsiniz.{' '}
            <strong style={{ color: 'var(--ink)' }}>2 dakikada kurulum, garson maliyeti sıfır.</strong>
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
            <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none' }}>
              <PrimaryButton size="lg">14 gün ücretsiz dene <MI.arrow /></PrimaryButton>
            </a>
            <GhostButton size="lg"><MI.play /> Canlı demoyu izle</GhostButton>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 28, flexWrap: 'wrap' }}>
            {['Kart gerekmez', 'Setup 2 dakika', '24/7 Türkçe destek'].map((t) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--positive)' }}><MI.check size={14} /></span>
                {t}
              </span>
            ))}
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}
