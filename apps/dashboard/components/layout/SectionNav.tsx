'use client'

import { useState } from 'react'
import { I, S } from '../../lib/ui'
import { InlineSpinner } from '@garsonless/ui'
import type { Icon } from '../../lib/ui'

const PAGE_SECTIONS = [
  { key: 'page',    label: 'Sayfa',           sub: 'Tüm sayfalara uygulanır',  icon: I.page },
  { key: 'header',  label: 'Başlık',          sub: 'Logo ve navigasyon stili', icon: I.header },
  { key: 'catnav',  label: 'Kategori Menüsü', sub: 'Yapışkan, kaydırılabilir', icon: I.nav },
  { key: 'card',    label: 'Ürün Kartı',      sub: 'Kart görünümü ve düzeni', icon: I.card },
  { key: 'cart',    label: 'Sepet Çekmecesi', sub: 'Sipariş akışı ve ödeme',  icon: I.cart },
] satisfies { key: string; label: string; sub: string; icon: Icon }[]

const GLOBAL_SECTIONS = [
  { key: 'colors',  label: 'Renkler',    sub: 'Marka renk paleti',     icon: I.palette },
  { key: 'type',    label: 'Tipografi',  sub: 'Yazı tipleri ve ölçek', icon: I.type },
  { key: 'layout',  label: 'Düzen',      sub: 'Izgara ve boşluklar',   icon: I.layout },
  { key: 'spacing', label: 'Boşluk',     sub: 'Yoğunluk ve ritm',      icon: I.spacing },
] satisfies { key: string; label: string; sub: string; icon: Icon }[]

interface NavRowProps {
  label: string
  sub: string
  icon: Icon
  active: boolean
  onClick: () => void
}

function NavRow({ label, sub, icon: IconComp, active, onClick }: NavRowProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 8px',
        background: active ? 'var(--surface-inset)' : (hov ? 'var(--surface-3)' : 'transparent'),
        border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
        color: active ? 'var(--text)' : 'var(--text-2)', marginBottom: 1, fontFamily: 'inherit',
      }}
    >
      <span style={{ display: 'inline-flex', color: active ? 'var(--text)' : 'var(--text-3)', flexShrink: 0 }}>
        <IconComp size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</span>
      </span>
      {hov && !active && (
        <span style={{ color: 'var(--text-4)', opacity: 0.8 }}>
          <I.drag size={14} />
        </span>
      )}
      {active && (
        <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>
          <I.chevRight size={14} />
        </span>
      )}
    </button>
  )
}

interface SectionNavProps {
  active: string
  setActive: (k: string) => void
  onTemplates: () => void
  onAIDesign?: () => void
  onAddSection?: () => void
  restaurantName: string
  chatInput?: string
  onChatInputChange?: (v: string) => void
  onChatSubmit?: () => void
  isChatting?: boolean
}

export default function SectionNav({ active, setActive, onTemplates, onAIDesign, onAddSection, restaurantName, chatInput = '', onChatInputChange, onChatSubmit, isChatting = false }: SectionNavProps) {
  const [search, setSearch] = useState('')

  const filteredPage = PAGE_SECTIONS.filter(s =>
    search === '' || s.label.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredGlobal = GLOBAL_SECTIONS.filter(s =>
    search === '' || s.label.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{
      width: 'var(--tb-nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            fontWeight: 600, fontSize: 13.5, letterSpacing: '-.01em',
            flex: 1, minWidth: 0, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Tema Düzenleyici
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 500, color: 'var(--positive)',
            background: 'var(--positive-bg)', padding: '2px 7px', borderRadius: 999, flexShrink: 0,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)', display: 'inline-block' }} />
            Canlı
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 10 }}>{restaurantName}</div>
        {onAIDesign && (
          <button type="button" onClick={onAIDesign} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, width: '100%', padding: '9px 0',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600,
            marginBottom: 8, fontFamily: 'inherit',
          }}>
            <I.sparkles size={14} />AI ile Tasarla
          </button>
        )}
        <button type="button" onClick={onTemplates} style={{
          width: '100%', padding: '7px 10px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <I.grid size={13} />
          Şablonlar
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px 6px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 30, padding: '0 10px',
          background: 'var(--surface-3)', borderRadius: 7, color: 'var(--text-3)',
        }}>
          <I.search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Bölümlerde ara"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 12.5, color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          {!search && (
            <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-4)' }}>⌘K</span>
          )}
        </div>
      </div>

      {/* Nav list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        <div style={{ ...S.label, padding: '6px 8px' }}>Sayfa Yapısı</div>
        {filteredPage.map(s => (
          <NavRow
            key={s.key}
            label={s.label}
            sub={s.sub}
            icon={s.icon}
            active={active === s.key}
            onClick={() => setActive(s.key)}
          />
        ))}

        <div style={{ ...S.label, padding: '14px 8px 6px' }}>Genel Stil</div>
        {filteredGlobal.map(s => (
          <NavRow
            key={s.key}
            label={s.label}
            sub={s.sub}
            icon={s.icon}
            active={active === s.key}
            onClick={() => setActive(s.key)}
          />
        ))}

        <button type="button" onClick={onAddSection} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 10px', marginTop: 8,
          border: '1px dashed var(--border-strong)', background: 'transparent',
          color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit',
        }}>
          <I.plus size={14} />
          Bölüm ekle
        </button>
      </div>

      {onChatInputChange && onChatSubmit && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center',
            background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px',
          }}>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}><I.sparkles size={14} /></span>
            <input
              value={chatInput}
              onChange={e => onChatInputChange(e.target.value)}
              placeholder="AI'ya sor: 'daha koyu yap'..."
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: 12, color: 'var(--text)', outline: 'none',
                fontFamily: 'inherit',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && chatInput.trim() && !isChatting) {
                  onChatSubmit()
                }
              }}
            />
            {isChatting && <InlineSpinner size={12} color="var(--text-3)" />}
          </div>
        </div>
      )}
    </div>
  )
}
