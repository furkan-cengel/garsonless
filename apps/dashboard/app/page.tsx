'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AppIconNodes } from '@garsonless/ui/icons'
import { PLAN_PRICES, type SelfServePlan } from '@garsonless/domain/entitlements'

/* ── CSS vars + keyframes ─────────────────────────────────── */
const MARKETING_CSS = `
[data-scope="marketing"] {
  --bg: #fdfaf5; --bg-2: #f8f3eb; --surface: #ffffff;
  --ink: #1c1814; --ink-2: #4a443e; --ink-3: #7a7166; --ink-4: #a89e91;
  --line: #e8dfd0; --line-soft: #f0e8d9;
  --brand: #a13b7a; --brand-soft: #f5e8f0;
  --accent: #d97757; --accent-2: #ffd089;
  --positive: #137a4d; --night: #1a1612;
  color: var(--ink); background: var(--bg);
  font-family: var(--font-geist), system-ui, sans-serif; line-height: 1.5;
}
[data-scope="marketing"] .fd { font-family: var(--font-fraunces), Georgia, serif; font-feature-settings: "ss01"; }
[data-scope="marketing"] .fs { font-family: var(--font-pacifico), cursive; }
[data-scope="marketing"] .gm { font-family: var(--font-geist-mono), ui-monospace, monospace; }
::selection { background: var(--brand); color: #fff; }
@keyframes float { 0%,100% { transform: rotate(-4deg) translateY(0); } 50% { transform: rotate(-4deg) translateY(-10px); } }
@keyframes mfloat { 0%,100% { transform: rotate(8deg) translateY(0); } 50% { transform: rotate(8deg) translateY(-6px); } }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
`

/* ── Primitives ───────────────────────────────────────────── */
const ctr: React.CSSProperties = { maxWidth: 1240, margin: '0 auto', padding: '0 32px' }
const fd: React.CSSProperties  = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
const fs: React.CSSProperties  = { fontFamily: 'var(--font-pacifico), cursive' }
const gm: React.CSSProperties  = { fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }

type IconProps = { d: React.ReactNode; size?: number; sw?: number; fill?: string }
function MIcon({ d, size = 18, sw = 1.6, fill = 'none' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  )
}

const MI = {
  arrow: AppIconNodes.arrow,
  check: AppIconNodes.check,
  x: AppIconNodes.x,
  plus: AppIconNodes.plus,
  play: AppIconNodes.play,
  star:    <MIcon d={<path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 16.5 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" fill="currentColor" stroke="none" />} />,
  ext:     <MIcon d="M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />,
  cutlery: AppIconNodes.cutlery,
  cart: AppIconNodes.cart,
  palette: AppIconNodes.palette,
  chart: AppIconNodes.chart,
  ig:      <MIcon d={<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></>} />,
  tw:      <MIcon d={<path d="M4 4l7.5 9L4.5 20h2.5l5.5-5.7L17 20h3l-7.7-9.4L19.5 4H17l-5 5.4L8 4Z" fill="currentColor" stroke="none" />} />,
  lk:      <MIcon d={<><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M7 10v7M7 7v.01M11 10v7M11 13a2 2 0 0 1 4 0v4"/></>} />,
}

type BtnSize = 'sm' | 'md' | 'lg'
function PrimaryButton({ children, size = 'md', dark, style = {}, onClick }: { children: React.ReactNode; size?: BtnSize; dark?: boolean; style?: React.CSSProperties; onClick?: () => void }) {
  const p = size === 'lg' ? '14px 22px' : size === 'sm' ? '8px 14px' : '11px 18px'
  const fs2 = size === 'lg' ? 15.5 : size === 'sm' ? 13 : 14
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: p,
      fontSize: fs2, fontWeight: 600, border: 'none', borderRadius: 999,
      background: dark ? 'var(--night)' : 'var(--ink)', color: dark ? 'var(--accent-2)' : '#fff',
      cursor: 'pointer', letterSpacing: '-0.005em',
      boxShadow: '0 1px 0 rgba(255,255,255,.08) inset, 0 4px 14px -4px rgba(28,24,20,.35)',
      ...style,
    }}>{children}</button>
  )
}

function GhostButton({ children, size = 'md', onClick }: { children: React.ReactNode; size?: BtnSize; onClick?: () => void }) {
  const p = size === 'lg' ? '14px 22px' : '11px 18px'
  const fs2 = size === 'lg' ? 15.5 : 14
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: p, fontSize: fs2, fontWeight: 600,
      border: '1.5px solid var(--ink)', borderRadius: 999,
      background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
    }}>{children}</button>
  )
}

type EyebrowTone = 'brand' | 'warm' | 'ink' | 'cream'
function Eyebrow({ children, tone = 'brand' }: { children: React.ReactNode; tone?: EyebrowTone }) {
  const TONES: Record<EyebrowTone, { bg: string; fg: string }> = {
    brand: { bg: 'var(--brand-soft)', fg: 'var(--brand)' },
    warm:  { bg: '#fbeee2',           fg: 'var(--accent)' },
    ink:   { bg: 'var(--ink)',        fg: 'var(--accent-2)' },
    cream: { bg: 'var(--bg-2)',       fg: 'var(--ink-2)' },
  }
  const t = TONES[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999, background: t.bg, color: t.fg,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: t.fg }} />
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, sub, align = 'center', tone, maxW = 720 }: {
  eyebrow?: string; title: React.ReactNode; sub?: string; align?: 'center' | 'left'; tone?: EyebrowTone; maxW?: number
}) {
  return (
    <div style={{ textAlign: align, maxWidth: maxW, margin: align === 'center' ? '0 auto 56px' : '0 0 48px' }}>
      {eyebrow && <div style={{ marginBottom: 16 }}><Eyebrow tone={tone}>{eyebrow}</Eyebrow></div>}
      <h2 className="fd" style={{ ...fd, fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, color: 'var(--ink)' }}>{title}</h2>
      {sub && <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: 600 }}>{sub}</p>}
    </div>
  )
}

/* ── NAV ─────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled ? 'rgba(253,250,245,.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      transition: 'all 200ms',
    }}>
      <div style={{ ...ctr, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={93} height={20} priority style={{ height: 20, width: 'auto', display: 'block' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {['Özellikler', 'Demo', 'Fiyatlandırma', 'Hikayeler', 'Kaynaklar'].map(l => (
            <a key={l} href={'#' + l.toLowerCase()} style={{ padding: '8px 14px', fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none', borderRadius: 7 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/auth/login" style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', textDecoration: 'none' }}>Giriş yap</Link>
          <Link href="/auth/signup" style={{ textDecoration: 'none' }}><PrimaryButton size="sm">14 gün ücretsiz dene {MI.arrow}</PrimaryButton></Link>
        </div>
      </div>
    </nav>
  )
}

/* ── HERO ────────────────────────────────────────────────── */
function HeroVisual() {
  return (
    <div style={{ position: 'relative', height: 580 }}>
      {/* Dashboard — back */}
      <div style={{ position: 'absolute', right: 0, top: 40, width: 540, background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', boxShadow: '0 30px 80px -20px rgba(28,24,20,.25), 0 4px 12px rgba(28,24,20,.08)', transform: 'rotate(2deg)' }}>
        <div style={{ height: 32, background: '#f6f1e8', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />)}
          <span style={{ marginLeft: 14, ...gm, fontSize: 11, color: 'var(--ink-3)' }}>maf-cafe.masabu.co/pano</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Bugünkü ciro', value: '₺18.420', d: '+24%', dark: true },
              { label: 'Sipariş',      value: '142',     d: '+18' },
              { label: 'Ort. sepet',   value: '₺129',    d: '-2%' },
            ].map((k, i) => (
              <div key={i} style={{ padding: 11, borderRadius: 9, background: k.dark ? 'var(--night)' : 'var(--bg-2)', color: k.dark ? '#fff' : 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
                {k.dark && <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: 'radial-gradient(circle, rgba(255,208,137,.2), transparent 60%)' }} />}
                <div style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{k.label}</div>
                <div style={{ ...gm, fontSize: 18, fontWeight: 700, marginTop: 3, color: k.dark ? 'var(--accent-2)' : 'var(--ink)' }}>{k.value}</div>
                <div style={{ fontSize: 9.5, marginTop: 2, color: k.dark ? '#5ee8a4' : 'var(--positive)', fontWeight: 600 }}>↑ {k.d}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-2)', borderRadius: 9, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Saatlik akış · bugün</div>
            <svg viewBox="0 0 320 60" width="100%" style={{ display: 'block' }}>
              {[12,22,32,40,54,72,86,68,42,32,46,64,80,70,46,32].map((h, i) => (
                <rect key={i} x={i * 19 + 2} y={86 - h} width="14" height={h} rx="2" fill={i === 10 ? '#ffd089' : 'var(--ink)'} opacity={i === 10 ? 1 : 0.85} />
              ))}
            </svg>
          </div>
        </div>
      </div>
      {/* Phone — front */}
      <div style={{ position: 'absolute', left: 10, top: 0, width: 230, height: 470, borderRadius: 32, background: '#0b0a08', padding: 8, boxShadow: '0 40px 100px -25px rgba(28,24,20,.35), 0 0 0 .5px #0b0a08', animation: 'float 5s ease-in-out infinite', zIndex: 2 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 25, overflow: 'hidden', background: '#fdfaf5', position: 'relative', fontFamily: 'Geist, sans-serif' }}>
          <div style={{ height: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
            <span>9:41</span>
            <span style={{ width: 16, height: 8, borderRadius: 2, border: '1.2px solid currentColor', position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: 1, background: 'currentColor', borderRadius: 1, width: '70%' }} />
            </span>
          </div>
          <div style={{ padding: '4px 14px 10px' }}>
            <div style={{ ...fs, fontSize: 22, color: 'var(--brand)', lineHeight: 1 }}>Acımarka</div>
            <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--positive)' }} />Masa 5 · Açık
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '0 14px 10px', overflowX: 'hidden' }}>
            {['Kahvaltı','Kahveler','Tatlılar'].map((c, i) => (
              <span key={c} style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: i === 0 ? 'var(--brand)' : 'transparent', color: i === 0 ? '#fff' : 'var(--ink-3)', border: i === 0 ? 'none' : '1px solid var(--line)', flexShrink: 0 }}>{c}</span>
            ))}
          </div>
          <div style={{ ...fs, fontSize: 18, color: 'var(--brand)', padding: '0 14px 8px', lineHeight: 1 }}>Kahvaltı</div>
          <div style={{ padding: '0 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { tint: '#fce8d3', e: '🍳', n: 'Serpme', p: '₺380', tag: 'Pop.' },
              { tint: '#dcf0e1', e: '🥑', n: 'Avokado', p: '₺220', tag: 'Yeni' },
              { tint: '#fde7c2', e: '🍅', n: 'Menemen', p: '₺180' },
              { tint: '#fbd3c1', e: '🍳', n: 'Sahanda', p: '₺140' },
            ].map((p, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(15,17,21,.04), 0 4px 10px -6px rgba(15,17,21,.1)', overflow: 'hidden' }}>
                <div style={{ height: 36, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, position: 'relative' }}>
                  {p.e}
                  {p.tag && <span style={{ position: 'absolute', top: 3, left: 3, background: '#fff', color: 'var(--brand)', fontSize: 6.5, fontWeight: 700, padding: '1.5px 4px', borderRadius: 999 }}>{p.tag}</span>}
                </div>
                <div style={{ padding: '5px 6px 6px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--brand)', fontSize: 9 }}>{p.n}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 9 }}>{p.p}</span>
                    <span style={{ width: 14, height: 14, borderRadius: 999, background: '#7eb928', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 12, right: 12, bottom: 18, background: 'var(--ink)', color: '#fff', borderRadius: 11, padding: '8px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,.4)' }}>
            <span style={{ fontWeight: 600, fontSize: 11 }}>🛒 Sepeti gör</span>
            <span style={{ fontWeight: 700, fontSize: 11 }}>₺780</span>
          </div>
        </div>
      </div>
      {/* QR badge */}
      <div style={{ position: 'absolute', left: 200, top: 360, width: 88, height: 88, borderRadius: 12, background: '#fff', padding: 10, boxShadow: '0 20px 50px -10px rgba(28,24,20,.25)', animation: 'mfloat 6s ease-in-out infinite', animationDelay: '0.5s', zIndex: 3 }}>
        <svg viewBox="0 0 14 14" style={{ width: '100%', height: '100%' }}>
          <rect x="0" y="0" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="1" y="1" width="2" height="2" fill="#fff" />
          <rect x="10" y="0" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="11" y="1" width="2" height="2" fill="#fff" />
          <rect x="0" y="10" width="4" height="4" fill="var(--ink)" rx=".5" />
          <rect x="1" y="11" width="2" height="2" fill="#fff" />
          {[[5,1],[6,2],[7,1],[8,3],[5,3],[7,5],[9,5],[5,5],[6,7],[8,7],[10,6],[11,8],[5,8],[7,9],[9,11],[11,11],[5,11],[7,12],[10,10]].map(([x,y], i) => (
            <rect key={i} x={x} y={y} width="1.4" height="1.4" rx=".3" fill="var(--ink)" />
          ))}
        </svg>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '64px 0 120px' }}>
      <div style={{ position: 'absolute', top: -100, right: -150, width: 540, height: 540, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,.18), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -120, left: -120, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(161,59,122,.14), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ ...ctr, display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, alignItems: 'center', position: 'relative' }}>
        <div>
          <Eyebrow tone="ink">Yeni · Sesli sipariş AI</Eyebrow>
          <h1 style={{ ...fd, fontSize: 'clamp(48px, 6.2vw, 84px)', fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 0.98, margin: '24px 0 0', color: 'var(--ink)' }}>
            Kafeniz, garson <br />
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontStyle: 'italic', color: 'var(--brand)' }}>beklemeden</span>
              <svg viewBox="0 0 280 14" style={{ position: 'absolute', left: 0, bottom: -8, width: '100%', height: 12 }}>
                <path d="M3 8 Q 70 2 140 7 T 277 6" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>{' '}işliyor.
          </h1>
          <p style={{ fontSize: 19, color: 'var(--ink-2)', lineHeight: 1.5, margin: '32px 0 0', maxWidth: 520 }}>
            Müşterileriniz QR'ı tarar, menüden sipariş verir, ödeme yapar. Siz de mutfakta olan biteni tek ekrandan yönetirsiniz. <strong style={{ color: 'var(--ink)' }}>2 dakikada kurulum, garson maliyeti sıfır.</strong>
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
            <Link href="/auth/signup" style={{ textDecoration: 'none' }}><PrimaryButton size="lg">14 gün ücretsiz dene {MI.arrow}</PrimaryButton></Link>
            <GhostButton size="lg">{MI.play} Canlı demoyu izle</GhostButton>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 28, flexWrap: 'wrap' }}>
            {['Kart gerekmez','Setup 2 dakika','24/7 Türkçe destek'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--positive)' }}>{MI.check}</span> {t}
              </span>
            ))}
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  )
}

/* ── SOCIAL PROOF ────────────────────────────────────────── */
function SocialProof() {
  const logos = [
    { name: 'Acımarka', s: fs }, { name: 'MAF CAFE', s: { fontFamily: 'Geist', fontWeight: 800, letterSpacing: '.08em' } },
    { name: 'Petra Coffee', s: { ...fd, fontStyle: 'italic', fontWeight: 500 } }, { name: 'Kahve&Co', s: gm },
    { name: 'Mor Köşe', s: fs }, { name: 'Northside', s: { fontFamily: 'Geist', fontWeight: 800, letterSpacing: '.08em' } },
    { name: 'Frenk', s: { ...fd, fontStyle: 'italic', fontWeight: 500 } }, { name: 'Bardak Bey', s: gm },
  ]
  const row = [...logos, ...logos]
  return (
    <section style={{ padding: '40px 0 80px', background: 'var(--bg)' }}>
      <div style={ctr}>
        <div style={{ textAlign: 'center', marginBottom: 28, fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '.04em' }}>
          Türkiye'de <strong style={{ color: 'var(--ink)' }}>2 400+ mekan</strong> tarafından kullanılıyor
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
          <div style={{ display: 'flex', gap: 56, width: 'max-content', animation: 'marquee 30s linear infinite' }}>
            {row.map((l, i) => (
              <span key={i} style={{ ...l.s, fontSize: 20, color: 'var(--ink-3)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', height: 36 }}>{l.name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── FEATURES ────────────────────────────────────────────── */
const FEATURES = [
  { id: 'menu', eyebrow: 'Menü', title: 'Menünüz, parmak ucunda.', desc: 'Sürükle-bırak ile dakikada hazır olan dijital menü. Görseller, alerjenler, varyantlar, çoklu dil.', icon: MI.cutlery, tint: '#fce8d3', accent: '#d97757' },
  { id: 'orders', eyebrow: 'Sipariş', title: 'Her masa, her ekran. Tek akış.', desc: "Mutfak ve bar canlı kanban'ı görsün. Geciken siparişler kırmızı yansın. Servis tek tıkla onayla.", icon: MI.cart, tint: '#dcf0e1', accent: '#137a4d' },
  { id: 'qr', eyebrow: 'QR Stüdyosu', title: 'Profesyonel QR — dakikada yazdırın.', desc: 'Markanıza göre renk, şekil, logo. Kart, şerit, telefon çerçevesinde. PDF, PNG, SVG olarak indirin.', icon: MI.palette, tint: '#f5dcea', accent: '#a13b7a' },
  { id: 'theme', eyebrow: 'Tema', title: 'Markanız gibi görünsün.', desc: 'Hazır şablonlardan başlayın, renk, tipografi, kart düzeni dahil her şeyi canlı önizleyin.', icon: MI.palette, tint: '#e7e3f0', accent: '#7a3aa3' },
  { id: 'analytics', eyebrow: 'Analiz', title: 'Sayılar, kararları kolaylaştırsın.', desc: 'En çok ne satıyor, hangi saat yoğun, hangi masa en kârlı. Tek bakışta görün, kaydedin, paylaşın.', icon: MI.chart, tint: '#cfe8f8', accent: '#1f4e8f' },
]

function FeatureScreenshot({ id, tint: _tint }: { id: string; tint: string }) {
  if (id === 'orders') {
    const COLS = [
      { label: 'Yeni', bg: '#fef3e2', fg: '#a55a00', count: 2 },
      { label: 'Hazırlan.', bg: '#e7eef8', fg: '#1f4e8f', count: 3 },
      { label: 'Hazır', bg: '#e6f4ec', fg: '#137a4d', count: 1 },
    ]
    const cards = [
      [{ id: 'AC-241', table: 'M5', n: 4, t: '₺384' }, { id: 'AC-242', table: 'B1', n: 2, t: '₺295' }],
      [{ id: 'AC-238', table: 'M2', n: 5, t: '₺580' }, { id: 'AC-239', table: 'M7', n: 2, t: '₺175' }, { id: 'AC-237', table: 'M9', n: 6, t: '₺720', late: true }],
      [{ id: 'AC-235', table: 'M3', n: 3, t: '₺285' }],
    ]
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, background: '#f9f4ec' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: c }} />)}
          <span style={{ marginLeft: 8, ...gm, fontSize: 10.5, color: 'var(--ink-3)' }}>Siparişler</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />Canlı · 6 aktif</span>
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {COLS.map((c, ci) => (
            <div key={ci} style={{ background: '#fafaf7', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
              <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '2px 7px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 9.5, fontWeight: 700 }}>{c.count}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{c.label}</span>
              </div>
              <div style={{ padding: '0 6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(cards[ci] ?? []).map((card, i) => (
                  <div key={i} style={{ padding: '7px 9px', background: '#fff', borderRadius: 6, border: '1px solid ' + ((card as { late?: boolean }).late ? '#b42318' : 'var(--line-soft)'), borderLeft: '3px solid ' + (ci === 0 ? '#a55a00' : ci === 1 ? '#1f4e8f' : '#137a4d'), fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700 }}>{card.table}</span>
                      <span style={{ ...gm, fontWeight: 700 }}>{card.t}</span>
                    </div>
                    <div style={{ ...gm, fontSize: 8.5, color: 'var(--ink-3)', marginTop: 2 }}>{card.id} · {card.n} ürün</div>
                    {(card as { late?: boolean }).late && <div style={{ marginTop: 4, fontSize: 8, fontWeight: 700, color: '#b42318' }}>⚠ Gecikme</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (id === 'analytics') {
    const data = [14, 16, 18, 22, 28, 21]
    const max = Math.max(...data)
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>7 günlük ciro</div>
            <div style={{ ...gm, fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>₺128.450</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, background: '#e6f4ec', color: 'var(--positive)', fontSize: 11, fontWeight: 700 }}>↑ %18.4</span>
        </div>
        <svg viewBox="0 0 320 120" width="100%" style={{ display: 'block' }}>
          <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1c1814" stopOpacity=".18"/><stop offset="100%" stopColor="#1c1814" stopOpacity="0"/></linearGradient></defs>
          {[0,1,2,3].map(p => <line key={p} x1="0" y1={20 + p*25} x2="320" y2={20 + p*25} stroke="var(--line)" strokeDasharray="3,3" />)}
          {(() => {
            const pts = data.map((v, i) => [i * 50 + 20, 120 - 10 - (v / max) * 80] as [number, number])
            const last = pts[pts.length - 1]!
            const first = pts[0]!
            const hl = pts[4]!
            const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
            const area = `${line} L ${last[0]} 110 L ${first[0]} 110 Z`
            return (<>
              <path d={area} fill="url(#ga)" />
              <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke="var(--ink)" strokeWidth="2" />)}
              <circle cx={hl[0]} cy={hl[1]} r="5" fill="#ffd089" stroke="var(--ink)" strokeWidth="2" />
              <rect x={hl[0] - 22} y={hl[1] - 22} width="44" height="16" rx="3" fill="var(--ink)" />
              <text x={hl[0]} y={hl[1] - 11} fontSize="10" fill="#ffd089" textAnchor="middle" fontFamily="Geist Mono" fontWeight="700">₺28K</text>
            </>)
          })()}
        </svg>
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#e6f4ec', borderRadius: 7, fontSize: 11, color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: 6 }}>✨ <span><strong>Cumartesi rekor:</strong> ₺28.420 — son 3 ayın en yükseği</span></div>
      </div>
    )
  }
  if (id === 'menu') {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18), 0 2px 6px rgba(28,24,20,.06)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 5, background: '#f9f4ec' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: c }} />)}
          <span style={{ marginLeft: 8, ...gm, fontSize: 10.5, color: 'var(--ink-3)' }}>Menü</span>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { e: '🍳', n: 'Serpme Kahvaltı', p: '₺380', t: '#fce8d3', tag: 'Popüler' },
            { e: '🥑', n: 'Avokado Toast',   p: '₺220', t: '#dcf0e1', tag: 'Yeni' },
            { e: '🍅', n: 'Menemen',          p: '₺180', t: '#fde7c2' },
            { e: '☕', n: 'Türk Kahvesi',     p: '₺75',  t: '#fce8d3' },
            { e: '🧀', n: 'Künefe',           p: '₺145', t: '#fbd3c1' },
            { e: '🍮', n: 'Lokum Latte',      p: '₺95',  t: '#f5dcea' },
          ].map((it, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
              <div style={{ height: 56, background: it.t, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
                {it.e}
                {it.tag && <span style={{ position: 'absolute', top: 4, left: 4, background: '#fff', color: 'var(--brand)', fontSize: 7.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>{it.tag}</span>}
              </div>
              <div style={{ padding: '7px 9px 9px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)' }}>{it.n}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ ...gm, fontSize: 10.5, fontWeight: 700 }}>{it.p}</span>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (id === 'qr') {
    return (
      <div style={{ background: 'linear-gradient(135deg, #fdf6ec 0%, #f5e8f0 100%)', borderRadius: 14, padding: 24, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ background: '#fff', border: '2px solid var(--brand)', borderRadius: 14, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 168 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Masa 5</div>
          <svg viewBox="0 0 14 14" style={{ width: 120, height: 120, margin: '8px 0' }}>
            <rect x="0" y="0" width="4" height="4" fill="var(--brand)" rx="1" />
            <rect x="1" y="1" width="2" height="2" fill="#fff" />
            <rect x="10" y="0" width="4" height="4" fill="var(--brand)" rx="1" />
            <rect x="11" y="1" width="2" height="2" fill="#fff" />
            <rect x="0" y="10" width="4" height="4" fill="var(--brand)" rx="1" />
            <rect x="1" y="11" width="2" height="2" fill="#fff" />
            {([[5,1],[7,1],[6,2],[8,3],[5,3],[7,5],[9,5],[5,5],[6,7],[8,7],[10,6],[5,8],[7,9],[9,11],[11,11],[5,11],[7,12],[10,10],[11,8]] as [number,number][]).map(([x,y], i) => (
              <circle key={i} cx={x + 0.7} cy={y + 0.7} r=".55" fill="var(--brand)" />
            ))}
            <rect x="6" y="6" width="2" height="2" fill="#fff" />
            <text x="7" y="7.8" fontSize="2" fontFamily="Pacifico, cursive" fill="var(--brand)" textAnchor="middle">A</text>
          </svg>
          <div style={{ ...fd, fontSize: 14, fontWeight: 600, color: 'var(--brand)', letterSpacing: '-.02em' }}>Menüyü tara</div>
          <div style={{ fontSize: 8.5, color: 'var(--ink-3)', marginTop: 2 }}>Kameranla okut</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {([
            { col: '#1c1814', dots: 'rounded' },
            { col: '#a13b7a', dots: 'dots' },
            { col: '#d97757', dots: 'square' },
            { col: '#137a4d', dots: 'rounded' },
          ] as { col: string; dots: 'rounded' | 'dots' | 'square' }[]).map((s, i) => (
            <div key={i} style={{ width: 48, height: 48, padding: 6, background: '#fff', borderRadius: 8, border: '1.5px solid ' + (i === 1 ? 'var(--ink)' : 'var(--line)'), boxShadow: i === 1 ? '0 0 0 3px rgba(28,24,20,.08)' : 'none' }}>
              <svg viewBox="0 0 12 12" style={{ width: '100%', height: '100%' }}>
                {([[0,0,3],[8,0,3],[0,8,3]] as [number,number,number][]).map(([x,y,sz], j) => (
                  <rect key={j} x={x} y={y} width={sz} height={sz} fill={s.col} rx={s.dots === 'rounded' ? 0.8 : 0} />
                ))}
                {([[4,1],[5,2],[6,1],[4,3],[5,5],[7,4],[8,6],[5,7],[7,9],[4,8],[6,10],[10,5],[9,11],[10,9]] as [number,number][]).map(([x,y], j) => (
                  s.dots === 'dots'
                    ? <circle key={j} cx={x+.5} cy={y+.5} r=".45" fill={s.col} />
                    : <rect key={j} x={x} y={y} width="1" height="1" rx={s.dots === 'rounded' ? 0.3 : 0} fill={s.col} />
                ))}
              </svg>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (id === 'theme') {
    return (
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18), 0 2px 6px rgba(28,24,20,.06)', border: '1px solid var(--line)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 200px' }}>
        <div style={{ padding: 16, background: '#f8f3eb' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Önizleme</div>
          <div style={{ background: '#fdfaf5', borderRadius: 10, padding: 12, boxShadow: '0 4px 12px rgba(28,24,20,.08)' }}>
            <div style={{ ...fs, fontSize: 22, color: 'var(--brand)', lineHeight: 1, marginBottom: 8 }}>Acımarka</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {['Kahvaltı','Kahveler','Tatlılar'].map((c,i) => (
                <span key={c} style={{ fontSize: 8.5, fontWeight: 600, padding: '2.5px 7px', borderRadius: 999, background: i===0 ? 'var(--brand)' : 'transparent', color: i===0 ? '#fff' : 'var(--ink-3)', border: i===0 ? 'none' : '1px solid #e3e4e7' }}>{c}</span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[{e:'🍳',n:'Serpme',p:'₺380'},{e:'🥑',n:'Avokado',p:'₺220'}].map((it,i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 6, padding: 6 }}>
                  <div style={{ height: 24, background: '#fce8d3', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{it.e}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--brand)', marginTop: 3 }}>{it.n}</div>
                  <div style={{ ...gm, fontSize: 8, fontWeight: 700, marginTop: 1 }}>{it.p}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: 14, borderLeft: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8 }}>Marka rengi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 12 }}>
            {['#a13b7a','#2f6f4e','#b8551c','#1f4e8f','#7a3aa3','#1c1d20'].map((c,i) => (
              <div key={c} style={{ aspectRatio: '1', borderRadius: 5, background: c, border: i===0 ? '1.5px solid var(--ink)' : 'none', boxShadow: i===0 ? '0 0 0 2px #fff, 0 0 0 3.5px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
            ))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Tipografi</div>
          <div style={{ padding: 8, background: 'var(--bg-2)', borderRadius: 5, marginBottom: 8 }}>
            <div style={{ ...fs, fontSize: 14, color: 'var(--brand)' }}>Pacifico</div>
            <div style={{ fontSize: 10.5, fontWeight: 600 }}>Nunito</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Köşe</div>
          <input type="range" defaultValue="60" style={{ width: '100%', accentColor: 'var(--ink)' }} />
        </div>
      </div>
    )
  }
  return null
}

function Features() {
  return (
    <section id="özellikler" style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div style={ctr}>
        <SectionHead eyebrow="Ne sunuyoruz" title={<>Garsonsuz değil, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>garson dertsiz</em>.</>} sub="Beş ürün, bir hesap. Hepsi birbirine bağlı, hepsi anında çalışıyor." tone="brand" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {FEATURES.map((f, i) => (
            <article key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', padding: 32, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', [i % 2 === 1 ? 'left' : 'right']: -120, top: -120, width: 380, height: 380, borderRadius: '50%', background: `radial-gradient(circle, ${f.tint}, transparent 65%)`, opacity: .9, pointerEvents: 'none' }} />
              <div style={{ order: i % 2 === 1 ? 2 : 1, position: 'relative', zIndex: 1 }}>
                <Eyebrow tone="cream"><span style={{ color: f.accent }}><MIcon d={(f.icon as React.ReactElement<IconProps>).props.d} size={12} /></span> {f.eyebrow}</Eyebrow>
                <h3 style={{ ...fd, fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '18px 0 0', color: 'var(--ink)' }}>{f.title}</h3>
                <p style={{ fontSize: 16.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '16px 0 0', maxWidth: 460 }}>{f.desc}</p>
                <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 24, fontSize: 14, fontWeight: 600, color: f.accent, textDecoration: 'none' }}>Yakından bak <MIcon d="M5 12h14M13 6l6 6-6 6" size={15} /></a>
              </div>
              <div style={{ order: i % 2 === 1 ? 1 : 2, position: 'relative', zIndex: 1 }}>
                <FeatureScreenshot id={f.id} tint={f.tint} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── INTERACTIVE DEMO ────────────────────────────────────── */
function DemoPhone() {
  return (
    <div style={{ width: 280, height: 580, borderRadius: 40, background: '#0a0908', padding: 10, boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 30, background: '#fdfaf5', overflow: 'hidden', position: 'relative', color: 'var(--ink)' }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 18px 5px', fontSize: 12, fontWeight: 700 }}><span>9:41</span><span>•••</span></div>
        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{ ...fs, fontSize: 26, color: 'var(--brand)' }}>Acımarka</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />Masa 5 · Açık</div>
        </div>
        <div style={{ display: 'flex', gap: 5, padding: '0 16px 12px' }}>
          {['Kahvaltı','Kahveler','Tatlılar'].map((c, i) => (
            <span key={c} style={{ fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: i === 0 ? 'var(--brand)' : 'transparent', color: i === 0 ? '#fff' : 'var(--ink-3)', border: i === 0 ? 'none' : '1px solid var(--line)' }}>{c}</span>
          ))}
        </div>
        <div style={{ ...fs, fontSize: 19, color: 'var(--brand)', padding: '0 16px 8px', lineHeight: 1 }}>Kahvaltı</div>
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { e: '🍳', n: 'Serpme Kahvaltı', p: '₺380', tint: '#fce8d3', tag: 'Popüler' },
            { e: '🥑', n: 'Avokado Toast',   p: '₺220', tint: '#dcf0e1', tag: 'Yeni' },
            { e: '🍅', n: 'Menemen',          p: '₺180', tint: '#fde7c2' },
            { e: '🍳', n: 'Sahanda',          p: '₺140', tint: '#fbd3c1' },
          ].map((it, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 9, boxShadow: '0 2px 8px -4px rgba(15,17,21,.15)', overflow: 'hidden' }}>
              <div style={{ height: 56, background: it.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, position: 'relative' }}>
                {it.e}
                {it.tag && <span style={{ position: 'absolute', top: 5, left: 5, background: '#fff', color: 'var(--brand)', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>{it.tag}</span>}
              </div>
              <div style={{ padding: '7px 9px 8px' }}>
                <div style={{ fontWeight: 700, color: 'var(--brand)', fontSize: 11 }}>{it.n}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ ...gm, fontWeight: 700, fontSize: 10.5 }}>{it.p}</span>
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: '#7eb928', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>+</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 22, background: 'var(--ink)', color: '#fff', borderRadius: 12, padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>🛒 Sepeti gör · 3</span>
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>₺780,00</span>
        </div>
      </div>
    </div>
  )
}

function DemoAdmin() {
  return (
    <div style={{ width: '100%', maxWidth: 720, background: '#fdfaf5', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', color: 'var(--ink)' }}>
      <div style={{ height: 32, background: '#f6f1e8', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
        {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />)}
        <span style={{ marginLeft: 12, ...gm, fontSize: 11, color: 'var(--ink-3)' }}>maf-cafe.masabu.co</span>
      </div>
      <div style={{ padding: 20 }}>
        <h3 style={{ ...fd, fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', margin: 0 }}>Günaydın, Ayşe 👋</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {[
            { label: 'Bugünkü ciro', value: '₺18.420', d: '+24%', dark: true },
            { label: 'Sipariş', value: '142', d: '+18' },
            { label: 'Ort. sepet', value: '₺129', d: '-2%' },
            { label: 'Misafir', value: '186', d: '+12%' },
          ].map((k, i) => (
            <div key={i} style={{ padding: 11, borderRadius: 9, background: k.dark ? 'var(--night)' : '#fff', color: k.dark ? '#fff' : 'var(--ink)', border: k.dark ? 'none' : '1px solid var(--line)' }}>
              <div style={{ fontSize: 9.5, opacity: .65, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ ...gm, fontSize: 19, fontWeight: 700, marginTop: 4, color: k.dark ? 'var(--accent-2)' : 'var(--ink)' }}>{k.value}</div>
              <div style={{ fontSize: 9.5, marginTop: 3, color: k.dark ? '#5ee8a4' : 'var(--positive)', fontWeight: 600 }}>↑ {k.d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: 14, background: '#fff', borderRadius: 10, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Saatlik akış</div>
          <svg viewBox="0 0 400 80" width="100%" style={{ display: 'block' }}>
            {[12,22,32,40,54,72,86,68,42,32,46,64,80,70,46,32,42,38].map((h, i) => (
              <rect key={i} x={i * 21 + 4} y={86 - h} width="16" height={h} rx="2" fill={i === 10 ? '#ffd089' : 'var(--ink)'} opacity={i === 10 ? 1 : 0.85} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

function DemoKitchen() {
  return (
    <div style={{ width: '100%', maxWidth: 720, background: '#0a0a0c', borderRadius: 12, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {[
        { id: 'AC-238', table: 'Masa 2', age: 8,  items: [{q:1,n:'Serpme Kahvaltı'},{q:2,n:'Türk Kahvesi'}], priority: 'normal' as const },
        { id: 'AC-237', table: 'Masa 9', age: 14, items: [{q:1,n:'Menemen'},{q:1,n:'Avokado',mod:'Vegan'},{q:1,n:'Künefe'}], note: 'Acı yok!', priority: 'urgent' as const },
        { id: 'AC-241', table: 'Masa 5', age: 4,  items: [{q:1,n:'Serpme'},{q:2,n:'Türk Kahvesi',mod:'Şekersiz'}], priority: 'new' as const },
      ].map(o => (
        <div key={o.id} style={{ background: '#15151a', borderRadius: 9, overflow: 'hidden', border: '1px solid #232328', ...(o.priority === 'urgent' ? { boxShadow: '0 0 0 1.5px #ff8b6b' } : {}) }}>
          <div style={{ padding: '10px 12px', background: o.priority === 'new' ? '#f0b429' : o.priority === 'urgent' ? '#b42318' : '#3a3a40', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{o.table}</div>
              <div style={{ ...gm, fontSize: 9, opacity: .8 }}>#{o.id}</div>
            </div>
            <div style={{ ...gm, fontSize: 18, fontWeight: 800, color: o.priority === 'urgent' ? '#fff' : '#ffd089' }}>{o.age}<span style={{ fontSize: 10, opacity: .7 }}>dk</span></div>
          </div>
          <div style={{ padding: '8px 12px', color: '#fff' }}>
            {o.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 11 }}>
                <span style={{ ...gm, fontSize: 14, color: '#ffd089', fontWeight: 700, width: 20 }}>{it.q}×</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.n}</div>
                  {(it as { mod?: string }).mod && <div style={{ fontSize: 9, color: '#7a7c83', marginTop: 1 }}>↳ {(it as { mod?: string }).mod}</div>}
                </div>
              </div>
            ))}
            {o.note && <div style={{ marginTop: 6, padding: '5px 8px', background: 'rgba(245,158,11,.12)', color: '#ffd089', borderRadius: 4, borderLeft: '2px solid #f0b429', fontSize: 10, fontWeight: 500 }}>📝 {o.note}</div>}
          </div>
          <div style={{ padding: '6px 8px', borderTop: '1px solid #232328' }}>
            <div style={{ width: '100%', height: 28, background: '#5ee8a4', color: '#063b22', borderRadius: 5, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓ Hazır</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function InteractiveDemo() {
  const [view, setView] = useState<'phone' | 'admin' | 'kitchen'>('phone')
  return (
    <section id="demo" style={{ padding: '120px 0', background: 'var(--night)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.12), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ ...ctr, position: 'relative' }}>
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 56px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,208,137,.15)', color: 'var(--accent-2)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent-2)' }} />Canlı demo
          </span>
          <h2 style={{ ...fd, fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '20px 0 0' }}>İçeri girin, <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>kendiniz deneyin</em>.</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, marginTop: 18 }}>Demo verileriyle dolu gerçek bir hesap. Hiçbir şey kaydetmez, istediğiniz gibi gezinin.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: 4, border: '1px solid rgba(255,255,255,.08)' }}>
            {[
              { id: 'phone' as const, label: 'Müşteri ekranı' },
              { id: 'admin' as const, label: 'Pano' },
              { id: 'kitchen' as const, label: 'Mutfak' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: view === v.id ? '#fff' : 'transparent', color: view === v.id ? 'var(--ink)' : '#fff', border: 'none', borderRadius: 999, cursor: 'pointer' }}>{v.label}</button>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 480, position: 'relative' }}>
          {view === 'phone' && <DemoPhone />}
          {view === 'admin' && <DemoAdmin />}
          {view === 'kitchen' && <DemoKitchen />}
        </div>
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <Link href="/auth/signup" style={{ textDecoration: 'none' }}><PrimaryButton dark size="lg">14 gün ücretsiz dene {MI.arrow}</PrimaryButton></Link>
        </div>
      </div>
    </section>
  )
}

/* ── STORIES ─────────────────────────────────────────────── */
const STORIES = [
  { quote: "Açtığımız ilk hafta personel 3 kişiydi, şimdi 2. Müşteri memnuniyeti arttı, biz daha çok mutfakla ilgileniyoruz.", name: 'Defne Aksoy', role: 'MAF Cafe Lounge · Kurucu', avatar: 'DA', color: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)', metric: { label: 'Sipariş süresi', value: '−38%' }, tint: '#fdf6ec' },
  { quote: "Sıkışık günlerde sipariş kuyruğunda kaybolmayı bıraktık. Mutfak ekranı sayesinde herkes önceliği görüyor.", name: 'Burak Kaplan', role: 'Petra Coffee · İşletmeci', avatar: 'BK', color: 'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)', metric: { label: 'Aylık ciro', value: '+%24' }, tint: '#eaf3ed' },
  { quote: "QR'ları yaydırıp koyduğumuz akşam sahnedeydim. Akşamın sonunda 'Bu nasıl bu kadar hızlı?' diye sordular.", name: 'Ayşegül Tan', role: 'Mor Köşe · Sahibe', avatar: 'AT', color: 'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)', metric: { label: 'Kurulum süresi', value: '12 dk' }, tint: '#e7eef8' },
]

function Stories() {
  return (
    <section id="hikayeler" style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div style={ctr}>
        <SectionHead eyebrow="Hikayeler" title={<>"Sayılarla değil, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>yüzlerle</em> sevindik."</>} sub="2 400+ mekan kullanıyor — ve bize neden seçtiklerini paylaşıyorlar." tone="warm" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {STORIES.map((s, i) => (
            <article key={i} style={{ background: 'var(--surface)', borderRadius: 18, padding: 28, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${s.tint}, transparent 65%)`, pointerEvents: 'none' }} />
              <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
                {Array(5).fill(0).map((_, j) => <span key={j} style={{ color: '#f0b429' }}><MIcon d={(MI.star as React.ReactElement<IconProps>).props.d} size={16} fill="currentColor" sw={0} /></span>)}
              </div>
              <blockquote style={{ ...fd, fontSize: 19, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.4, letterSpacing: '-.01em', margin: 0, color: 'var(--ink)', flex: 1, position: 'relative' }}>&ldquo;{s.quote}&rdquo;</blockquote>
              <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{s.metric.label}</span>
                <span style={{ ...gm, fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>{s.metric.value}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: s.color, color: 'var(--ink)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.avatar}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── PRICING ─────────────────────────────────────────────── */
type PricingCardPlan = {
  id: SelfServePlan | 'business'; name: string; desc: string; cta: string
  highlight: boolean; badge?: string; features: Array<{ text: string; on: boolean }>
}

const PLANS: PricingCardPlan[] = [
  { id: 'starter', name: 'Starter', desc: 'Profesyonel dijital menü için', cta: '14 gün ücretsiz dene', highlight: false,
    features: [{ text: 'Sınırsız ürün ve kategori', on: true }, { text: 'QR menü ve zengin ürün içeriği', on: true }, { text: 'Çekirdek tema editörü', on: true }] },
  { id: 'plus', name: 'Plus', desc: 'Masa ve adisyon operasyonu için', cta: '14 gün ücretsiz dene', highlight: false,
    features: [{ text: "Starter'daki her şey", on: true }, { text: 'Masa bazlı QR ve QR Studio', on: true }, { text: 'Personel siparişi ve temel raporlar', on: true }] },
  { id: 'pro', name: 'Pro', desc: 'Misafir siparişinden sadakate tam operasyon', cta: '14 gün ücretsiz dene', highlight: true, badge: 'En çok tercih edilen',
    features: [{ text: "Plus'taki her şey", on: true }, { text: 'QR siparişi, KDS ve online ödeme', on: true }, { text: 'CRM, sadakat ve gelişmiş raporlar', on: true }] },
  { id: 'business', name: 'Business', desc: 'Birden fazla şube ve ortak ekip için', cta: 'Bizimle konuş', highlight: false,
    features: [{ text: "Pro'nun tüm özellikleri", on: true }, { text: 'Organizasyon ve ortak ekip erişimi', on: true }, { text: 'Güvenli şube geçişi', on: true }] },
]

function formatTry(minor: number, digits: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100)
}

function Pricing() {
  const [yearly, setYearly] = useState(false)
  return (
    <section id="fiyatlandırma" style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div style={ctr}>
        <SectionHead eyebrow="Fiyatlandırma" title={<>Her şey dahil. <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>Sürpriz yok.</em></>} sub="Tüm yeni işletmeler 14 günlük Pro denemesiyle başlar." />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--bg-2)', borderRadius: 999, border: '1px solid var(--line)' }}>
            <button onClick={() => setYearly(false)} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: !yearly ? 'var(--ink)' : 'transparent', color: !yearly ? '#fff' : 'var(--ink-2)', border: 'none', borderRadius: 999 }}>Aylık</button>
            <button onClick={() => setYearly(true)} style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: yearly ? 'var(--ink)' : 'transparent', color: yearly ? '#fff' : 'var(--ink-2)', border: 'none', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Yıllık <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--accent-2)', color: 'var(--ink)' }}>−%20</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 1240, margin: '0 auto' }}>
          {PLANS.map(plan => {
            const isBusiness = plan.id === 'business'
            const price = plan.id === 'business' ? null : PLAN_PRICES[plan.id][yearly ? 'annual' : 'monthly']
            const displayedMinor = price && yearly ? Math.round(price.amountMinor / 12) : price?.amountMinor
            const href = isBusiness ? 'https://masabu.co/company?subject=business#iletişim' : `/auth/signup?plan=${plan.id}`
            return (
              <article key={plan.id} style={{ background: plan.highlight ? 'var(--night)' : 'var(--surface)', color: plan.highlight ? '#fff' : 'var(--ink)', borderRadius: 20, padding: 32, border: plan.highlight ? '1px solid var(--night)' : '1px solid var(--line)', position: 'relative', ...(plan.highlight ? { transform: 'translateY(-12px)', boxShadow: '0 30px 60px -20px rgba(0,0,0,.3), 0 0 0 1px rgba(255,208,137,.2) inset', overflow: 'hidden' } : {}) }}>
                {plan.highlight && <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.18), transparent 65%)' }} />}
                {plan.badge && <span style={{ position: 'absolute', top: 16, right: 16, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-2)', color: 'var(--ink)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{plan.badge}</span>}
                <div style={{ position: 'relative' }}>
                  <h3 style={{ ...fd, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', margin: 0, color: plan.highlight ? 'var(--accent-2)' : 'var(--ink)' }}>{plan.name}</h3>
                  <p style={{ fontSize: 13.5, color: plan.highlight ? 'rgba(255,255,255,.6)' : 'var(--ink-3)', marginTop: 6 }}>{plan.desc}</p>
                  <div style={{ margin: '24px 0 4px', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {isBusiness ? <span style={{ ...fd, fontSize: 38, fontWeight: 600, letterSpacing: '-.02em' }}>Özel teklif</span> : (
                      <><span style={{ ...fd, fontSize: 42, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{formatTry(displayedMinor ?? 0, yearly ? 2 : 0)}</span><span style={{ fontSize: 14, color: plan.highlight ? 'rgba(255,255,255,.55)' : 'var(--ink-3)' }}>/ay</span></>
                    )}
                  </div>
                  {!isBusiness && yearly && price && <div style={{ fontSize: 12, color: 'var(--positive)', fontWeight: 600 }}>Yıllık peşin {formatTry(price.amountMinor, 2)}</div>}
                  <Link href={href} style={{ textDecoration: 'none' }}>
                    <button style={{ marginTop: 24, width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 600, background: plan.highlight ? 'var(--accent-2)' : 'var(--ink)', color: plan.highlight ? 'var(--ink)' : '#fff', border: 'none', borderRadius: 999, cursor: 'pointer' }}>{plan.cta}</button>
                  </Link>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: f.on ? (plan.highlight ? '#fff' : 'var(--ink)') : (plan.highlight ? 'rgba(255,255,255,.35)' : 'var(--ink-4)') }}>
                        <span style={{ color: f.on ? (plan.highlight ? 'var(--accent-2)' : 'var(--positive)') : 'currentColor', marginTop: 2 }}>
                          <MIcon d={f.on ? "m5 12 5 5 9-11" : "m6 6 12 12M18 6 6 18"} size={14} sw={2} />
                        </span>
                        <span style={{ lineHeight: 1.45, ...(!f.on ? { textDecoration: 'line-through', opacity: .7 } : {}) }}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--ink-3)' }}>KDV dâhil · Sipariş komisyonu yok · Yıllık ücret peşin tahsil edilir</div>
      </div>
    </section>
  )
}

/* ── COMPARE ─────────────────────────────────────────────── */
function Compare() {
  const rows = [
    { feature: 'QR menü',                    garson: true,  adisyo: true,  pos: true,  zenchef: true },
    { feature: 'Self-service sipariş',        garson: true,  adisyo: false, pos: 'opt', zenchef: false },
    { feature: 'Canlı mutfak ekranı',         garson: true,  adisyo: false, pos: true,  zenchef: false },
    { feature: 'QR stüdyosu (özel tasarım)', garson: true,  adisyo: false, pos: false, zenchef: false },
    { feature: 'Tema özelleştirme',           garson: 'full', adisyo: 'lim', pos: false, zenchef: 'lim' },
    { feature: 'Çoklu dil (4+)',              garson: true,  adisyo: false, pos: 'opt', zenchef: true },
    { feature: 'AI içgörüler',                garson: true,  adisyo: false, pos: false, zenchef: false },
    { feature: 'Türkçe destek',              garson: true,  adisyo: true,  pos: 'lim', zenchef: false },
    { feature: 'Sipariş başı komisyon',       garson: 'no',  adisyo: 'no',  pos: 'no',  zenchef: '0.5%' },
    { feature: 'Aylık başlangıç ücreti',      garson: '₺0',  adisyo: '₺499', pos: '₺899', zenchef: '€89' },
  ]
  type CellValue = boolean | 'opt' | 'lim' | 'full' | 'no' | string
  function CompareCell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
    let content: React.ReactNode
    if (value === true) content = <span style={{ color: 'var(--positive)' }}><MIcon d="m5 12 5 5 9-11" size={18} sw={2} /></span>
    else if (value === false) content = <span style={{ color: 'var(--ink-4)' }}><MIcon d="m6 6 12 12M18 6 6 18" size={16} /></span>
    else if (value === 'opt') content = <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Opsiyonel</span>
    else if (value === 'lim') content = <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Sınırlı</span>
    else if (value === 'full') content = <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700 }}>Tam</span>
    else if (value === 'no') content = <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 600 }}>Yok</span>
    else content = <span style={{ ...gm, fontSize: 13, fontWeight: highlight ? 700 : 500 }}>{value}</span>
    return <div style={{ padding: '14px 14px', textAlign: 'center', borderLeft: '1px solid var(--line)', background: highlight ? 'rgba(255,208,137,.15)' : 'transparent' }}>{content}</div>
  }
  return (
    <section style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div style={ctr}>
        <SectionHead eyebrow="Kıyaslama" title={<>Neden <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>masabu?</em></>} sub="Tüm rakiplerin yapabildiğini yapar — ve fazlasını." />
        <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'var(--night)', color: '#fff' }}>
            <div style={{ padding: '18px 22px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Özellik</div>
            <div style={{ padding: '18px 14px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.08)', background: 'var(--accent-2)', color: 'var(--ink)' }}>
              <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={74} height={16} style={{ height: 16, width: 'auto', display: 'inline-block' }} />
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, opacity: .75 }}>Bizim ürün</div>
            </div>
            {['Adisyo','Klasik POS','Zenchef'].map(n => <div key={n} style={{ padding: '18px 14px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.08)', fontSize: 14, fontWeight: 600 }}>{n}</div>)}
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderTop: '1px solid var(--line)', background: i % 2 === 1 ? 'var(--bg-2)' : 'transparent' }}>
              <div style={{ padding: '14px 22px', fontSize: 14, fontWeight: 500 }}>{r.feature}</div>
              <CompareCell value={r.garson} highlight />
              <CompareCell value={r.adisyo} />
              <CompareCell value={r.pos} />
              <CompareCell value={r.zenchef} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── FAQ ─────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  { q: 'Kurulum ne kadar sürer?', a: 'Ortalama 2 dakika. Mağazanı oluşturuyorsun, menünü yükleyebiliyorsun (CSV/Yemeksepeti/Trendyol\'dan içe aktarma destekli) ve QR kodlarını yazdırıyorsun. Yardıma ihtiyacın olursa Türkçe ekibimiz 7/24 yanında.' },
  { q: 'Mevcut POS sistemimle çalışır mı?', a: "Evet — iyzico, Vallet, Logo, Mikro ve Netsis ile direkt entegre. Webhook + API ile her POS'a bağlanabilirsin." },
  { q: 'Sipariş başı komisyon var mı?', a: "Yok. Bizden alınan tek ücret aylık abonelik. Ödeme komisyonu doğrudan iyzico'ya gider (kart için %1,8 + ₺2,5). Nakit ödemeler tamamen sizin." },
  { q: "Müşterilerimin uygulama indirmesi gerekir mi?", a: "Hayır. QR'ı tarayınca tarayıcıda menü açılır. iOS, Android, hatta tuşlu telefonların tarayıcısında bile çalışır." },
  { q: 'Bir mağazadan fazla mı yöneteceğim?', a: "Pro plan 3'e kadar, Business sınırsız mağaza destekler." },
  { q: 'Verilerim güvende mi?', a: "Türkiye'de sunucularımızda barındırılır, KVKK uyumludur. SOC 2 Type II sertifikalıdır. Otomatik günlük yedek + 90 gün geri yükleme." },
  { q: 'İptal etmek istersem?', a: 'Tek tıkla iptal et. Verilerini dışa aktarmak için 60 günün var.' },
]

function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div style={{ ...ctr, maxWidth: 880 }}>
        <SectionHead eyebrow="SSS" title={<>Aklındaki <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>sorular</em>.</>} sub="Burada cevabını bulamadın mı? Bize yaz — 5 dakikada dönelim." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ background: open === i ? 'var(--surface)' : 'transparent', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '20px 24px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{item.q}</span>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: open === i ? 'var(--ink)' : 'var(--bg-2)', color: open === i ? '#fff' : 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 16 }}>
                  {open === i ? <MIcon d="m6 6 12 12M18 6 6 18" size={14} /> : <MIcon d="M12 5v14M5 12h14" size={14} sw={2} />}
                </span>
              </button>
              {open === i && <div style={{ padding: '0 24px 22px', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65 }}>{item.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── RESOURCES ───────────────────────────────────────────── */
const POSTS = [
  { tag: 'Rehber',  read: '6 dk', title: 'QR menüden gerçek satışa: 7 adımda kurulum', tint: '#fce8d3' },
  { tag: 'Vaka',    read: '4 dk', title: 'MAF Cafe nasıl %24 ciro artışı sağladı?',     tint: '#dcf0e1' },
  { tag: 'Tasarım', read: '8 dk', title: 'Müşteriyi sipariş ekranında tutan 5 prensip',  tint: '#f5dcea' },
]

function Resources() {
  return (
    <section id="kaynaklar" style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div style={ctr}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Eyebrow tone="warm">Blog & Kaynaklar</Eyebrow>
            <h2 style={{ ...fd, fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '16px 0 0', color: 'var(--ink)' }}>Daha iyi bir mekan, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>daha iyi okuyarak</em>.</h2>
          </div>
          <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', padding: '10px 18px', border: '1.5px solid var(--ink)', borderRadius: 999 }}>Tüm yazılar <MIcon d="M5 12h14M13 6l6 6-6 6" size={15} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {POSTS.map((p, i) => (
            <a key={i} href="#" style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(28,24,20,.15)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ height: 180, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg viewBox="0 0 200 100" width="60%" style={{ opacity: .4 }}>
                  <circle cx="50" cy="50" r="30" fill="var(--ink)" />
                  <rect x="100" y="30" width="80" height="6" fill="var(--ink)" rx="3" />
                  <rect x="100" y="46" width="60" height="6" fill="var(--ink)" rx="3" opacity=".6" />
                  <rect x="100" y="62" width="70" height="6" fill="var(--ink)" rx="3" opacity=".3" />
                </svg>
                <span style={{ position: 'absolute', top: 14, left: 14, padding: '4px 10px', borderRadius: 999, background: '#fff', color: 'var(--ink)', fontSize: 11, fontWeight: 700 }}>{p.tag}</span>
              </div>
              <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ ...fd, fontSize: 20, fontWeight: 600, letterSpacing: '-.015em', lineHeight: 1.25, margin: 0, flex: 1 }}>{p.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                  <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--ink-4)' }} />{p.read} okuma
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── BIG CTA ─────────────────────────────────────────────── */
function BigCTA() {
  return (
    <section style={{ padding: '0 32px 60px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1176, margin: '0 auto', background: 'var(--night)', borderRadius: 32, padding: '80px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.15), transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,.13), transparent 65%)' }} />
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 720, margin: '0 auto', color: '#fff' }}>
          <Eyebrow tone="ink">14 gün ücretsiz</Eyebrow>
          <h2 style={{ ...fd, fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 0' }}>Bugün başlayın. <br /><em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>Yarın garsonsuz</em> olun.</h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.65)', marginTop: 24, lineHeight: 1.5 }}>Kart bilgisi yok. Kurulum 2 dakika. İlk siparişiniz bugün düşsün.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
            <Link href="/auth/signup" style={{ textDecoration: 'none' }}><PrimaryButton dark size="lg">14 gün ücretsiz dene {MI.arrow}</PrimaryButton></Link>
            <button style={{ padding: '14px 22px', fontSize: 15.5, fontWeight: 600, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>Demo görüşme planla</button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── FOOTER ──────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: 'Ürün',      items: ['Menü','Sipariş','QR Stüdyosu','Tema','Analiz','Mutfak ekranı'] },
    { title: 'Çözümler',  items: ['Kafeler','Restoranlar','Bar & meyhane','Zincir & franchise','Otel restoranları'] },
    { title: 'Kaynaklar', items: ['Blog','Vaka çalışmaları','Yardım merkezi','API dokümanı','Şablonlar','Topluluk'] },
    { title: 'Şirket',    items: ['Hakkımızda','Kariyer','Basın','İletişim','Bayilik'] },
  ]
  return (
    <footer style={{ background: 'var(--bg)', padding: '100px 0 40px', borderTop: '1px solid var(--line)' }}>
      <div style={ctr}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 48, marginBottom: 56 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={102} height={22} style={{ height: 22, width: 'auto', display: 'block' }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>Türk gastronomisi için tasarlandı.<br />Mekanınız ister kafe ister fine-dining — biz oradayız.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {[MI.ig, MI.tw, MI.lk].map((ic, i) => (
                <a key={i} href="#" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MIcon d={(ic as React.ReactElement<IconProps>).props.d} size={16} />
                </a>
              ))}
            </div>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 16px' }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {col.items.map(item => <li key={item}><a href="#" style={{ fontSize: 14, color: 'var(--ink-2)', textDecoration: 'none' }}>{item}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 28, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>© 2026 masabu · İstanbul, Türkiye</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--ink-3)' }}>
            {['Gizlilik','Şartlar','KVKK','Çerezler'].map(l => <a key={l} href="#" style={{ textDecoration: 'none', color: 'inherit' }}>{l}</a>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--positive)' }} />Tüm sistemler operasyonel
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ── PAGE ────────────────────────────────────────────────── */
export default function MarketingPage() {
  return (
    <div data-scope="marketing">
      <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
      <Nav />
      <Hero />
      <SocialProof />
      <Features />
      <InteractiveDemo />
      <Stories />
      <Pricing />
      <Compare />
      <FAQ />
      <Resources />
      <BigCTA />
      <Footer />
    </div>
  )
}
