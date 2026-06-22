'use client'

import { useState } from 'react'
import { MI } from '../lib/icons'
import { PrimaryButton } from './ui/Buttons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

function DemoPhone() {
  return (
    <div style={{ width: 280, height: 580, borderRadius: 40, background: '#0a0908', padding: 10, boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 30, background: '#fdfaf5', overflow: 'hidden', position: 'relative', color: 'var(--ink)' }}>
        <div style={{ height: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 18px 5px', fontSize: 12, fontWeight: 700 }}>
          <span>9:41</span><span>•••</span>
        </div>
        <div style={{ padding: '4px 16px 12px' }}>
          <div className="font-script" style={{ fontSize: 26, color: 'var(--brand)' }}>Acımarka</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />Masa 5 · Açık
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, padding: '0 16px 12px' }}>
          {['Kahvaltı','Kahveler','Tatlılar'].map((c, i) => (
            <span key={c} style={{ fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: i === 0 ? 'var(--brand)' : 'transparent', color: i === 0 ? '#fff' : 'var(--ink-3)', border: i === 0 ? 'none' : '1px solid var(--line)' }}>{c}</span>
          ))}
        </div>
        <div className="font-script" style={{ fontSize: 19, color: 'var(--brand)', padding: '0 16px 8px', lineHeight: 1 }}>Kahvaltı</div>
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
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontWeight: 700, fontSize: 10.5 }}>{it.p}</span>
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
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />)}
        <span style={{ marginLeft: 12, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--ink-3)' }}>maf-cafe.garsonless.app</span>
      </div>
      <div style={{ padding: 20 }}>
        <h3 className="font-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', margin: 0 }}>Günaydın, Ayşe 👋</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
          {[
            { label: 'Bugünkü ciro', value: '₺18.420', d: '+24%', dark: true },
            { label: 'Sipariş',      value: '142',     d: '+18' },
            { label: 'Ort. sepet',   value: '₺129',    d: '-2%' },
            { label: 'Misafir',      value: '186',     d: '+12%' },
          ].map((k, i) => (
            <div key={i} style={{ padding: 11, borderRadius: 9, background: k.dark ? 'var(--night)' : '#fff', color: k.dark ? '#fff' : 'var(--ink)', border: k.dark ? 'none' : '1px solid var(--line)' }}>
              <div style={{ fontSize: 9.5, opacity: .65, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 19, fontWeight: 700, marginTop: 4, color: k.dark ? 'var(--accent-2)' : 'var(--ink)' }}>{k.value}</div>
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
      ].map((o) => (
        <div key={o.id} style={{ background: '#15151a', borderRadius: 9, overflow: 'hidden', border: '1px solid #232328', ...(o.priority === 'urgent' ? { boxShadow: '0 0 0 1.5px #ff8b6b' } : {}) }}>
          <div style={{
            padding: '10px 12px',
            background: o.priority === 'new' ? '#f0b429' : o.priority === 'urgent' ? '#b42318' : '#3a3a40',
            color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{o.table}</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, opacity: .8 }}>#{o.id}</div>
            </div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 800, color: o.priority === 'urgent' ? '#fff' : '#ffd089' }}>{o.age}<span style={{ fontSize: 10, opacity: .7 }}>dk</span></div>
          </div>
          <div style={{ padding: '8px 12px', color: '#fff' }}>
            {o.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 11 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: '#ffd089', fontWeight: 700, width: 20 }}>{it.q}×</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.n}</div>
                  {'mod' in it && it.mod && <div style={{ fontSize: 9, color: '#7a7c83', marginTop: 1 }}>↳ {it.mod}</div>}
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

type ViewId = 'phone' | 'admin' | 'kitchen'

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'phone',   label: 'Müşteri ekranı' },
  { id: 'admin',   label: 'Pano' },
  { id: 'kitchen', label: 'Mutfak' },
]

export function DemoVideo() {
  const [view, setView] = useState<ViewId>('phone')

  return (
    <section id="demo" style={{ padding: '120px 0', background: 'var(--night)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.12), transparent 65%)', pointerEvents: 'none' }} />
      <div className="container" style={{ position: 'relative' }}>
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 56px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,208,137,.15)', color: 'var(--accent-2)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent-2)' }} />
            Canlı demo
          </span>
          <h2 className="font-display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '20px 0 0' }}>
            İçeri girin, <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>kendiniz deneyin</em>.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, marginTop: 18 }}>
            Demo verileriyle dolu gerçek bir hesap. Hiçbir şey kaydetmez, istediğiniz gibi gezinin.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', gap: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: 4, border: '1px solid rgba(255,255,255,.08)' }}>
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600,
                background: view === v.id ? '#fff' : 'transparent',
                color: view === v.id ? 'var(--ink)' : '#fff',
                border: 'none', borderRadius: 999, cursor: 'pointer',
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 480, position: 'relative' }}>
          {view === 'phone'   && <DemoPhone />}
          {view === 'admin'   && <DemoAdmin />}
          {view === 'kitchen' && <DemoKitchen />}
          <div style={{ position: 'absolute', right: 24, top: 24 }}>
            <a href={`${DASHBOARD_URL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.15)', borderRadius: 999, textDecoration: 'none' }}>
              <MI.ext size={14} />Tam ekranda aç
            </a>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none' }}>
            <PrimaryButton dark size="lg">14 gün ücretsiz dene <MI.arrow /></PrimaryButton>
          </a>
        </div>
      </div>
    </section>
  )
}
