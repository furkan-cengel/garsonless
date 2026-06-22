import type { ReactNode } from 'react'
import { MI } from '../lib/icons'
import { Eyebrow } from './ui/Eyebrow'
import { SectionHead } from './ui/SectionHead'

function MenuScreenshot() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 5, background: '#f9f4ec' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: c }} />)}
        <span style={{ marginLeft: 8, fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--ink-3)' }}>Menü</span>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { e: '🍳', n: 'Serpme Kahvaltı', p: '₺380', tint: '#fce8d3', tag: 'Popüler' },
          { e: '🥑', n: 'Avokado Toast',   p: '₺220', tint: '#dcf0e1', tag: 'Yeni' },
          { e: '🍅', n: 'Menemen',          p: '₺180', tint: '#fde7c2' },
          { e: '☕', n: 'Türk Kahvesi',     p: '₺75',  tint: '#fce8d3' },
          { e: '🧀', n: 'Künefe',           p: '₺145', tint: '#fbd3c1' },
          { e: '🍮', n: 'Lokum Latte',      p: '₺95',  tint: '#f5dcea' },
        ].map((it, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
            <div style={{ height: 56, background: it.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
              {it.e}
              {it.tag && <span style={{ position: 'absolute', top: 4, left: 4, background: '#fff', color: 'var(--brand)', fontSize: 7.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>{it.tag}</span>}
            </div>
            <div style={{ padding: '7px 9px 9px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)' }}>{it.n}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, fontWeight: 700 }}>{it.p}</span>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersScreenshot() {
  const COLS = [
    { label: 'Yeni',      bg: '#fef3e2', fg: '#a55a00', count: 2 },
    { label: 'Hazırlan.', bg: '#e7eef8', fg: '#1f4e8f', count: 3 },
    { label: 'Hazır',     bg: '#e6f4ec', fg: '#137a4d', count: 1 },
  ]
  const cards = [
    [{ id: 'AC-241', table: 'M5', n: 4, t: '₺384', late: false }, { id: 'AC-242', table: 'B1', n: 2, t: '₺295', late: false }],
    [{ id: 'AC-238', table: 'M2', n: 5, t: '₺580', late: false }, { id: 'AC-239', table: 'M7', n: 2, t: '₺175', late: false }, { id: 'AC-237', table: 'M9', n: 6, t: '₺720', late: true }],
    [{ id: 'AC-235', table: 'M3', n: 3, t: '₺285', late: false }],
  ]
  const borderColors = ['#a55a00', '#1f4e8f', '#137a4d']
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, background: '#f9f4ec' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 9, height: 9, borderRadius: 999, background: c }} />)}
        <span style={{ marginLeft: 8, fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--ink-3)' }}>Siparişler</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />Canlı · 6 aktif
        </span>
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
                <div key={i} style={{
                  padding: '7px 9px', background: '#fff', borderRadius: 6,
                  border: '1px solid ' + (card.late ? '#b42318' : 'var(--line-soft)'),
                  borderLeft: '3px solid ' + borderColors[ci],
                  fontSize: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{card.table}</span>
                    <span style={{ fontFamily: 'Geist Mono, monospace', fontWeight: 700 }}>{card.t}</span>
                  </div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, color: 'var(--ink-3)', marginTop: 2 }}>{card.id} · {card.n} ürün</div>
                  {card.late && <div style={{ marginTop: 4, fontSize: 8, fontWeight: 700, color: '#b42318' }}>⚠ Gecikme</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QRScreenshot() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fdf6ec 0%, #f5e8f0 100%)',
      borderRadius: 14, padding: 24,
      boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{ background: '#fff', border: '2px solid var(--brand)', borderRadius: 14, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 168 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Masa 5</div>
        <svg viewBox="0 0 14 14" style={{ width: 120, height: 120, margin: '8px 0' }}>
          <rect x="0" y="0" width="4" height="4" fill="var(--brand)" rx="1" />
          <rect x="1" y="1" width="2" height="2" fill="#fff" />
          <rect x="10" y="0" width="4" height="4" fill="var(--brand)" rx="1" />
          <rect x="11" y="1" width="2" height="2" fill="#fff" />
          <rect x="0" y="10" width="4" height="4" fill="var(--brand)" rx="1" />
          <rect x="1" y="11" width="2" height="2" fill="#fff" />
          {([[5,1],[7,1],[6,2],[8,3],[5,3],[7,5],[9,5],[5,5],[6,7],[8,7],[10,6],[5,8],[7,9],[9,11],[11,11],[5,11],[7,12],[10,10],[11,8]] as [number,number][]).map(([x, y], i) => (
            <circle key={i} cx={x + 0.7} cy={y + 0.7} r=".55" fill="var(--brand)" />
          ))}
          <rect x="6" y="6" width="2" height="2" fill="#fff" />
        </svg>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', letterSpacing: '-.02em' }}>Menüyü tara</div>
        <div style={{ fontSize: 8.5, color: 'var(--ink-3)', marginTop: 2 }}>Kameranla okut</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { dots: 'rounded', col: '#1c1814' },
          { dots: 'dots',    col: '#a13b7a' },
          { dots: 'square',  col: '#d97757' },
          { dots: 'rounded', col: '#137a4d' },
        ].map((s, i) => (
          <div key={i} style={{ width: 48, height: 48, padding: 6, background: '#fff', borderRadius: 8, border: '1.5px solid ' + (i === 1 ? 'var(--ink)' : 'var(--line)') }}>
            <svg viewBox="0 0 12 12" style={{ width: '100%', height: '100%' }}>
              {[[0,0,3],[8,0,3],[0,8,3]].map(([x, y, sz], j) => (
                <rect key={j} x={x} y={y} width={sz} height={sz} fill={s.col} rx={s.dots === 'rounded' ? .8 : 0} />
              ))}
              {([[4,1],[5,2],[6,1],[4,3],[5,5],[7,4],[8,6],[5,7],[7,9],[4,8],[6,10],[10,5],[9,11],[10,9]] as [number,number][]).map(([x, y], j) => (
                s.dots === 'dots'
                  ? <circle key={j} cx={x + .5} cy={y + .5} r=".45" fill={s.col} />
                  : <rect key={j} x={x} y={y} width="1" height="1" rx={s.dots === 'rounded' ? .3 : 0} fill={s.col} />
              ))}
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThemeScreenshot() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 200px' }}>
      <div style={{ padding: 16, background: '#f8f3eb' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Önizleme</div>
        <div style={{ background: '#fdfaf5', borderRadius: 10, padding: 12, boxShadow: '0 4px 12px rgba(28,24,20,.08)' }}>
          <div className="font-script" style={{ fontSize: 22, color: 'var(--brand)', lineHeight: 1, marginBottom: 8 }}>Acımarka</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {['Kahvaltı','Kahveler','Tatlılar'].map((c, i) => (
              <span key={c} style={{ fontSize: 8.5, fontWeight: 600, padding: '2.5px 7px', borderRadius: 999, background: i === 0 ? 'var(--brand)' : 'transparent', color: i === 0 ? '#fff' : 'var(--ink-3)', border: i === 0 ? 'none' : '1px solid #e3e4e7' }}>{c}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {[{e:'🍳',n:'Serpme',p:'₺380'},{e:'🥑',n:'Avokado',p:'₺220'}].map((it, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 6, padding: 6 }}>
                <div style={{ height: 24, background: '#fce8d3', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{it.e}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--brand)', marginTop: 3 }}>{it.n}</div>
                <div style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Geist Mono, monospace', marginTop: 1 }}>{it.p}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: 14, borderLeft: '1px solid var(--line)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8 }}>Marka rengi</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 12 }}>
          {['#a13b7a','#2f6f4e','#b8551c','#1f4e8f','#7a3aa3','#1c1d20'].map((c, i) => (
            <div key={c} style={{ aspectRatio: '1', borderRadius: 5, background: c, border: i === 0 ? '1.5px solid var(--ink)' : 'none', boxShadow: i === 0 ? '0 0 0 2px #fff, 0 0 0 3.5px var(--ink)' : 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
          ))}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Tipografi</div>
        <div style={{ padding: 8, background: 'var(--bg-2)', borderRadius: 5, marginBottom: 8 }}>
          <div className="font-script" style={{ fontSize: 14, color: 'var(--brand)' }}>Pacifico</div>
          <div style={{ fontSize: 10.5, fontWeight: 600 }}>Nunito</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Köşe</div>
        <input type="range" defaultValue="60" style={{ width: '100%', accentColor: 'var(--ink)' }} />
      </div>
    </div>
  )
}

function AnalyticsScreenshot() {
  const data = [14, 16, 18, 22, 28, 21]
  const max = Math.max(...data)
  const pts = data.map((v, i) => [i * 50 + 20, 120 - 10 - (v / max) * 80] as [number, number])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const area = `${line} L ${pts.at(-1)![0]} 110 L ${pts[0]![0]} 110 Z`
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 50px -15px rgba(28,24,20,.18)', border: '1px solid var(--line)', padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>7 günlük ciro</div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>₺128.450</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, background: '#e6f4ec', color: 'var(--positive)', fontSize: 11, fontWeight: 700 }}>↑ %18.4</span>
      </div>
      <svg viewBox="0 0 320 120" width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1814" stopOpacity=".18" />
            <stop offset="100%" stopColor="#1c1814" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3].map((p) => <line key={p} x1="0" y1={20 + p * 25} x2="320" y2={20 + p * 25} stroke="var(--line)" strokeDasharray="3,3" />)}
        <path d={area} fill="url(#ga)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke="var(--ink)" strokeWidth="2" />)}
        <circle cx={pts[4]![0]} cy={pts[4]![1]} r="5" fill="#ffd089" stroke="var(--ink)" strokeWidth="2" />
        <rect x={pts[4]![0] - 22} y={pts[4]![1] - 22} width="44" height="16" rx="3" fill="var(--ink)" />
        <text x={pts[4]![0]} y={pts[4]![1] - 11} fontSize="10" fill="#ffd089" textAnchor="middle" fontFamily="Geist Mono, monospace" fontWeight="700">₺28K</text>
        {['Pzt','Sal','Çar','Per','Cum','Cmt'].map((d, i) => (
          <text key={d} x={i * 50 + 20} y="118" fontSize="9" fill="var(--ink-3)" textAnchor="middle" fontFamily="Geist Mono, monospace">{d}</text>
        ))}
      </svg>
      <div style={{ marginTop: 12, padding: '10px 12px', background: '#e6f4ec', borderRadius: 7, fontSize: 11, color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: 6 }}>
        ✨ <span><strong>Cumartesi rekor:</strong> ₺28.420 — son 3 ayın en yükseği</span>
      </div>
    </div>
  )
}

interface Feature {
  id: string
  eyebrow: string
  title: ReactNode
  desc: string
  icon: ReactNode
  tint: string
  accent: string
  screenshot: ReactNode
}

const FEATURES: Feature[] = [
  {
    id: 'menu',
    eyebrow: 'Menü',
    title: 'Menünüz, parmak ucunda.',
    desc: 'Sürükle-bırak ile dakikada hazır olan dijital menü. Görseller, alerjenler, varyantlar, çoklu dil.',
    icon: <MI.cutlery size={12} />,
    tint: '#fce8d3', accent: '#d97757',
    screenshot: <MenuScreenshot />,
  },
  {
    id: 'orders',
    eyebrow: 'Sipariş',
    title: 'Her masa, her ekran. Tek akış.',
    desc: "Mutfak ve bar canlı kanban'ı görsün. Geciken siparişler kırmızı yansın. Servis tek tıkla onayla.",
    icon: <MI.cart size={12} />,
    tint: '#dcf0e1', accent: '#137a4d',
    screenshot: <OrdersScreenshot />,
  },
  {
    id: 'qr',
    eyebrow: 'QR Stüdyosu',
    title: 'Profesyonel QR — dakikada yazdırın.',
    desc: 'Markanıza göre renk, şekil, logo. Kart, şerit, telefon çerçevesinde. PDF, PNG, SVG olarak indirin.',
    icon: <MI.qr size={12} />,
    tint: '#f5dcea', accent: '#a13b7a',
    screenshot: <QRScreenshot />,
  },
  {
    id: 'theme',
    eyebrow: 'Tema',
    title: 'Markanız gibi görünsün.',
    desc: 'Hazır şablonlardan başlayın, renk, tipografi, kart düzeni dahil her şeyi canlı önizleyin.',
    icon: <MI.palette size={12} />,
    tint: '#e7e3f0', accent: '#7a3aa3',
    screenshot: <ThemeScreenshot />,
  },
  {
    id: 'analytics',
    eyebrow: 'Analiz',
    title: 'Sayılar, kararları kolaylaştırsın.',
    desc: 'En çok ne satıyor, hangi saat yoğun, hangi masa en kârlı. Tek bakışta görün, kaydedin, paylaşın.',
    icon: <MI.chart size={12} />,
    tint: '#cfe8f8', accent: '#1f4e8f',
    screenshot: <AnalyticsScreenshot />,
  },
]

function FeatureRow({ feature, flip }: { feature: Feature; flip: boolean }) {
  return (
    <article style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: 64, alignItems: 'center', padding: 32,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', [flip ? 'left' : 'right']: -120, top: -120,
        width: 380, height: 380, borderRadius: '50%',
        background: `radial-gradient(circle, ${feature.tint}, transparent 65%)`,
        opacity: .9, pointerEvents: 'none',
      }} />
      <div style={{ order: flip ? 2 : 1, position: 'relative', zIndex: 1 }}>
        <Eyebrow tone="cream">
          <span style={{ color: feature.accent }}>{feature.icon}</span>
          {feature.eyebrow}
        </Eyebrow>
        <h3 className="font-display" style={{
          fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 500, letterSpacing: '-0.025em',
          lineHeight: 1.1, margin: '18px 0 0', color: 'var(--ink)',
        }}>{feature.title}</h3>
        <p style={{ fontSize: 16.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '16px 0 0', maxWidth: 460 }}>{feature.desc}</p>
        <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 24, fontSize: 14, fontWeight: 600, color: feature.accent, textDecoration: 'none' }}>
          Yakından bak <MI.arrow size={15} />
        </a>
      </div>
      <div style={{ order: flip ? 1 : 2, position: 'relative', zIndex: 1 }}>
        {feature.screenshot}
      </div>
    </article>
  )
}

export function FeaturesGrid() {
  return (
    <section id="özellikler" style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div className="container">
        <SectionHead
          eyebrow="Ne sunuyoruz"
          title={<>Garsonsuz değil, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>garson dertsiz</em>.</>}
          sub="Beş ürün, bir hesap. Hepsi birbirine bağlı, hepsi anında çalışıyor."
          tone="brand"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {FEATURES.map((f, i) => <FeatureRow key={f.id} feature={f} flip={i % 2 === 1} />)}
        </div>
      </div>
    </section>
  )
}
