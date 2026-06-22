'use client'

import { useState } from 'react'
import { I, S, Tag } from '../../lib/ui'

const ARTICLES = [
  { cat: 'Başlangıç', title: 'İlk QR kodumu nasıl oluştururum?',       read: '2 dk' },
  { cat: 'Menü',      title: 'Toplu fiyat güncelleme nasıl yapılır?',    read: '1 dk' },
  { cat: 'Sipariş',   title: 'Siparişleri yazıcıya nasıl bağlarım?',     read: '3 dk' },
  { cat: 'Tema',      title: 'Marka rengini tüm yüzeylere uygula',      read: '1 dk' },
  { cat: 'Ödeme',     title: 'iyzico entegrasyonu adım adım',           read: '4 dk' },
  { cat: 'Faturalama', title: 'Plan yükseltme ve fatura kesimi',         read: '2 dk' },
]

const QUICK_ACTIONS = [
  { Icon: I.sparkles, title: "Garsonless'i tanı",  desc: 'Etkileşimli 60 sn turu başlat', tag: 'Tur' as const },
  { Icon: I.cutlery,  title: 'Menü içe aktar',     desc: 'CSV veya Yemeksepeti / Trendyol bağla' },
  { Icon: I.qr,       title: 'QR kodları indir',   desc: 'Tüm masalar için PNG paketi' },
]

const kbd: React.CSSProperties = {
  display: 'inline-block', padding: '1px 5px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 3, fontFamily: "'Geist Mono', monospace",
  fontSize: 10, color: 'var(--text-2)', marginRight: 4,
}

interface Props {
  onClose: () => void
}

export default function HelpModal({ onClose }: Props) {
  const [q, setQ] = useState('')
  const filtered = q
    ? ARTICLES.filter(r => r.title.toLowerCase().includes(q.toLowerCase()))
    : ARTICLES

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(17,17,19,.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', paddingTop: 90,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxHeight: '70vh', background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px -10px rgba(0,0,0,.4), 0 0 0 1px rgba(17,17,19,.06)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderBottom: '1px solid var(--divider)',
        }}>
          <I.search size={18} />
          <input
            autoFocus
            placeholder="Yardım merkezinde ara..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 15, color: 'var(--text)',
            }}
          />
          <span style={{
            ...S.mono, fontSize: 11, color: 'var(--text-3)',
            padding: '3px 7px', background: 'var(--surface-3)', borderRadius: 5,
          }}>ESC</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {!q && (
            <div style={{ padding: '6px 8px 12px' }}>
              <div style={{ ...S.label, padding: '6px 12px' }}>Hızlı yardım</div>
              {QUICK_ACTIONS.map((a, i) => (
                <button
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 12px', textAlign: 'left',
                    background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: 'var(--surface-3)', color: 'var(--text-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <a.Icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{a.desc}</div>
                  </div>
                  {a.tag && <Tag tone="positive">{a.tag}</Tag>}
                  <span style={{ color: 'var(--text-4)' }}>
                    <I.chevRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '6px 8px 12px' }}>
            <div style={{ ...S.label, padding: '6px 12px' }}>
              {q ? 'Sonuçlar' : 'En çok okunanlar'}
            </div>
            {filtered.map((r, i) => (
              <button
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 12px', textAlign: 'left',
                  background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase',
                  color: 'var(--accent)', background: 'var(--accent-soft)',
                  padding: '3px 7px', borderRadius: 4, flexShrink: 0,
                }}>
                  {r.cat}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{r.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.read}</span>
              </button>
            ))}
            {q && filtered.length === 0 && (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
                &quot;{q}&quot; için sonuç bulunamadı
              </div>
            )}
          </div>
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)' }}>
            <span><kbd style={kbd}>↑↓</kbd> gezin</span>
            <span><kbd style={kbd}>↵</kbd> aç</span>
            <span><kbd style={kbd}>ESC</kbd> kapat</span>
          </div>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', height: 26,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, fontSize: 11.5, fontWeight: 500,
            color: 'var(--text)', cursor: 'pointer',
          }}>
            <I.sparkles size={12} />
            Canlı destek
          </button>
        </div>
      </div>
    </div>
  )
}
