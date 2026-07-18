'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'

const SYSTEM_FONTS = new Set(['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Bodoni 72'])

export function TemplateShowcasePreview({ id, theme, title }: {
  id: string
  theme: GarsonlessTheme
  title: string
}) {
  if (id === 'default') return <ClassicTemplatePhone theme={theme} />
  if (id === 'spain') return <SpainTemplatePhone />
  return <GenericTemplatePhone theme={theme} title={title} />
}

function ShowcasePhone({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: 20,
      transform: 'translateX(-50%)',
      width: 202,
      height: 348,
      borderRadius: 30,
      border: dark ? '7px solid #1d1e24' : '7px solid #0d0d0f',
      background: dark ? '#232442' : '#fff',
      overflow: 'hidden',
      boxShadow: '0 28px 54px rgba(20,25,31,.18)',
    }}>
      {children}
    </div>
  )
}

function ClassicTemplatePhone({ theme }: { theme: GarsonlessTheme }) {
  const dark = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <ShowcasePhone dark={dark}>
      <div style={{ height: '100%', background: theme.bg, color: dark ? '#fff' : '#15171c', fontFamily: previewFontCssValue(theme.bodyFont) }}>
        <div style={{ padding: 15, background: theme.headerBg, borderBottom: '1px solid rgba(46,125,82,.13)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{
              color: theme.accent,
              fontFamily: previewFontCssValue(theme.displayFont, true),
              fontSize: 25,
              lineHeight: .88,
              fontWeight: 850,
            }}>
              MAF Cafe<br />Lounge
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: dark ? 'rgba(255,255,255,.72)' : '#6b7280', fontSize: 9, paddingTop: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.cta }} />
              Masa 12
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 15px 78px' }}>
          <div style={{ display: 'flex', gap: 7, overflow: 'hidden', marginBottom: 18 }}>
            {['Kahvaltı', 'Kahveler', 'Tatlılar'].map((item, index) => (
              <span key={item} style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: '8px 11px',
                background: index === 0 ? theme.accent : '#fff',
                color: index === 0 ? '#fff' : theme.accent,
                border: index === 0 ? 'none' : '1px solid rgba(20,25,31,.09)',
                fontSize: 9,
                fontWeight: 850,
              }}>
                {item}
              </span>
            ))}
          </div>
          <h3 style={{
            margin: '0 0 14px',
            color: theme.accent,
            fontFamily: previewFontCssValue(theme.displayFont, true),
            fontSize: 21,
            lineHeight: 1,
            fontWeight: 850,
          }}>
            Kahvaltı
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TemplateProductTile theme={theme} title="Serpme Kahvaltı" price="₺380" tone={theme.accentSoft} />
            <TemplateProductTile theme={theme} title="Menemen" price="₺180" tone="#f7d89a" />
            <TemplateProductTile theme={theme} title="Avokado Toast" price="₺220" tone="#e8ecef" />
            <TemplateProductTile theme={theme} title="Türk Kahvesi" price="₺85" tone="#e9f3ee" />
          </div>
        </div>
        <div style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 14,
          height: 34,
          borderRadius: 999,
          background: dark ? '#fff' : '#1c1d20',
          color: dark ? '#111' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 15px',
          fontSize: 10,
          fontWeight: 850,
          boxShadow: '0 14px 28px rgba(20,25,31,.22)',
        }}>
          <span>Sepeti gör</span>
          <span>₺380</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function SpainTemplatePhone() {
  return (
    <ShowcasePhone>
      <div style={{ height: '100%', background: '#fff', padding: 14, color: '#17191d' }}>
        <div style={{ fontSize: 9, fontWeight: 800, marginBottom: 22 }}>9:41</div>
        <div style={{ height: 72, borderRadius: 18, background: '#fbf8f3', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: '#17191d', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900 }}>Bo</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Bowlicious</div>
            <div style={{ marginTop: 4, width: 92, height: 8, borderRadius: 999, background: '#e9e5df' }} />
            <div style={{ marginTop: 4, width: 76, height: 8, borderRadius: 999, background: '#efebe6' }} />
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: 'linear-gradient(135deg,#ff6b43,#ffd08a)', display: 'grid', placeItems: 'center', fontSize: 20 }}>●</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 14 }}>
          {['Teslimat', 'Paket', 'Salon'].map((item, index) => (
            <div key={item} style={{ height: 24, borderRadius: 999, background: index === 0 ? '#17191d' : '#f0f0f1', color: index === 0 ? '#fff' : '#6b6f78', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800 }}>{item}</div>
          ))}
        </div>
        <div style={{ height: 26, borderRadius: 999, border: '1px solid #e3e4e7', marginTop: 12 }} />
        <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
          {['Bowls', 'Salad', 'Soup'].map((item, index) => (
            <span key={item} style={{ fontSize: 8, borderRadius: 999, padding: '5px 9px', background: index === 0 ? '#17191d' : '#fff', color: index === 0 ? '#fff' : '#6b6f78' }}>{item}</span>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 900 }}>Bowls</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {['Shrimp Poke Bowl', 'Hawaiian Bowl'].map((item, index) => (
            <div key={item} style={{ height: 106, borderRadius: 11, border: '1px solid #ececef', overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 72, background: '#fff2dc', display: 'grid', placeItems: 'center', fontSize: 20 }}>{index === 0 ? '●' : '◐'}</div>
              <div style={{ padding: '6px 7px', fontSize: 7, fontWeight: 850 }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, height: 28, borderRadius: 999, border: '2px solid #ff6b43', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 8, fontWeight: 850 }}>
          <span>Sipariş detayı</span>
          <span>₺365</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function GenericTemplatePhone({ theme, title }: { theme: GarsonlessTheme; title: string }) {
  const dark = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <ShowcasePhone dark={dark}>
      <div style={{ height: '100%', background: theme.bg, color: dark ? '#fff' : '#15171c' }}>
        <div style={{ padding: 16, background: theme.headerBg, borderBottom: '1px solid rgba(20,25,31,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: theme.accent, fontSize: 20, lineHeight: 1, fontWeight: 900 }}>{title.split(' ')[0]}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: theme.accentSoft }} />
              <span style={{ width: 22, height: 22, borderRadius: 999, background: theme.accentSoft }} />
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['Kahvaltı', 'Kahveler', 'Tatlılar'].map((item, index) => (
              <span key={item} style={{ borderRadius: 999, padding: '8px 11px', background: index === 0 ? theme.accent : '#fff', color: index === 0 ? '#fff' : theme.accent, fontSize: 9, fontWeight: 850 }}>{item}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ height: 118, borderRadius: 12, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 22px rgba(20,25,31,.08)' }}>
              <div style={{ height: 58, background: `linear-gradient(135deg, ${theme.accentSoft}, ${theme.accent})` }} />
              <div style={{ padding: 10, color: theme.accent, fontSize: 10, fontWeight: 900 }}>Serpme</div>
            </div>
            <div style={{ height: 118, borderRadius: 12, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 22px rgba(20,25,31,.08)' }}>
              <div style={{ height: 58, background: `linear-gradient(135deg, ${theme.cta}, ${theme.accentSoft})` }} />
              <div style={{ padding: 10, color: theme.accent, fontSize: 10, fontWeight: 900 }}>Menemen</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, height: 34, borderRadius: 999, background: dark ? '#fff' : '#1c1d20', color: dark ? '#111' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 13px', fontSize: 10, fontWeight: 850 }}>
          <span>Sepeti gör</span>
          <span>₺380</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function TemplateProductTile({ theme, title, price, tone }: {
  theme: GarsonlessTheme
  title: string
  price: string
  tone: string
}) {
  return (
    <div style={{
      height: 92,
      borderRadius: 12,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 10px 22px rgba(20,25,31,.08)',
      border: '1px solid rgba(20,25,31,.06)',
    }}>
      <div style={{ height: 40, background: `linear-gradient(135deg, ${tone}, ${theme.accent})`, opacity: .55 }} />
      <div style={{ padding: '8px 9px', display: 'grid', gap: 5 }}>
        <div style={{ color: theme.accent, fontSize: 10, fontWeight: 900, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15171c', fontSize: 10, fontWeight: 900 }}>
          <span>{price}</span>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: theme.cta, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, lineHeight: 1 }}>+</span>
        </div>
      </div>
    </div>
  )
}

export function SectionMiniPreview({ id }: { id: string }) {
  const shell: CSSProperties = {
    height: 124,
    border: '1px solid var(--divider)',
    borderRadius: 9,
    background: 'var(--surface)',
    overflow: 'hidden',
    position: 'relative',
  }
  if (id === 'hero-banner') return (
    <div style={{ ...shell, padding: 12, background: 'linear-gradient(135deg, #a13b7a, #d97757)', color: '#fff' }}>
      <div style={{ position: 'absolute', left: 18, bottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }}>GÜN ÖZEL</div>
        <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 900 }}>Künefe<br />Tabağı</div>
        <div style={{ marginTop: 8, width: 88, height: 20, borderRadius: 999, background: '#fff' }} />
      </div>
    </div>
  )
  if (id === 'mode-tabs') return (
    <div style={{ ...shell, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 22 }}>
        {['Salon', 'Paket', 'Teslimat'].map((label, index) => (
          <div key={label} style={{ height: 28, borderRadius: 999, background: index === 0 ? 'var(--text)' : 'var(--surface-3)', color: index === 0 ? '#fff' : 'var(--text-3)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 750 }}>{label}</div>
        ))}
      </div>
    </div>
  )
  if (id === 'address-bar' || id === 'search') return (
    <div style={{ ...shell, padding: 24 }}>
      <div style={{ height: 36, borderRadius: 10, border: '1px solid var(--border)', marginTop: 18, display: 'flex', alignItems: 'center', padding: '0 13px', color: 'var(--text-3)', fontSize: 12 }}>
        {id === 'search' ? 'Ürün ara...' : 'Bağdat Cd. No: 128/A'}
        <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>→</span>
      </div>
    </div>
  )
  if (id === 'promo-strip') return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100%', height: 34, background: '#1c1d20', color: '#ffd089', display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' }}>
        İLK SİPARİŞE %20 İNDİRİM · BUGÜNE ÖZEL
      </div>
    </div>
  )
  if (id.includes('cat') || id === 'quick-links') return (
    <div style={{ ...shell, padding: 22 }}>
      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        {['Tümü', 'Kahvaltı', 'Kahve'].map((label, index) => (
          <div key={label} style={{ height: id === 'cat-images' ? 54 : 28, minWidth: id === 'cat-images' ? 54 : 70, borderRadius: id === 'cat-underline' ? 0 : 999, borderBottom: id === 'cat-underline' && index === 0 ? '2px solid var(--text)' : undefined, background: index === 0 && id !== 'cat-underline' ? 'var(--accent)' : 'var(--surface-3)', color: index === 0 && id !== 'cat-underline' ? '#fff' : 'var(--text-2)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 750 }}>{label}</div>
        ))}
      </div>
    </div>
  )
  if (id === 'featured-scroll' || id === 'minimal-list') return (
    <div style={{ ...shell, padding: 18 }}>
      <div style={{ display: id === 'featured-scroll' ? 'flex' : 'grid', gap: 8, marginTop: 18 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ width: id === 'featured-scroll' ? 72 : undefined, height: id === 'featured-scroll' ? 68 : 20, borderRadius: 8, background: item === 0 ? 'var(--accent-soft)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'chef-pick') return (
    <div style={{ ...shell, padding: 14, background: '#171717', color: '#fff' }}>
      <div style={{ width: 78, height: 10, borderRadius: 999, background: '#ffd089' }} />
      <div style={{ marginTop: 10, width: 130, height: 16, borderRadius: 999, background: 'rgba(255,255,255,.22)' }} />
      <div style={{ display: 'grid', gap: 7, marginTop: 14 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ height: 20, borderRadius: 8, background: item === 0 ? 'rgba(255,208,137,.95)' : 'rgba(255,255,255,.14)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'combo-ribbon') return (
    <div style={{ ...shell, padding: 8, background: '#fff7c9' }}>
      <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { color: '#8bbfb8', label: '-30%' },
          { color: '#c9776d', label: '-20%' },
          { color: '#ead294', label: '-15%' },
        ].map((item, index) => (
          <div
            key={item.color}
            style={{
              borderRadius: 6,
              background: item.color,
              color: '#fff',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 9,
              fontSize: 16,
              fontWeight: 900,
              overflow: 'hidden',
            }}
          >
            {index > 0 && (
              <span style={{
                position: 'absolute',
                top: -1,
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: 54,
                height: 17,
                borderRadius: 4,
                background: '#fff',
                color: item.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 900,
                letterSpacing: '.04em',
              }}>
                COMBO
              </span>
            )}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
  if (id === 'discount-badge') return (
    <div style={{ ...shell, padding: 14, display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div style={{
        width: 68,
        height: 68,
        borderRadius: 999,
        border: '2px solid #738779',
        color: '#738779',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: 9, fontWeight: 850, letterSpacing: '.04em' }}>FALL</span>
        <span style={{ fontSize: 21, fontWeight: 950, margin: '3px 0' }}>2x1</span>
        <span style={{ fontSize: 8, fontWeight: 850, letterSpacing: '.04em' }}>OFFER</span>
      </div>
    </div>
  )
  if (id === 'daily-special') return (
    <div style={{ ...shell, background: 'var(--surface)' }}>
      <div style={{ height: 72, background: 'linear-gradient(135deg,#b0447d,#e2785e)', padding: 12, color: '#fff' }}>
        <div style={{ width: 70, height: 16, borderRadius: 999, background: '#fff' }} />
        <div style={{ marginTop: 10, width: 118, height: 18, borderRadius: 7, background: 'rgba(255,255,255,.35)' }} />
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ width: 120, height: 9, borderRadius: 999, background: 'var(--surface-3)' }} />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 42, height: 12, borderRadius: 999, background: 'var(--text)' }} />
          <div style={{ marginLeft: 'auto', width: 54, height: 20, borderRadius: 999, background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  )
  if (id === 'promo-slider') return (
    <div style={{ ...shell, padding: 12 }}>
      <div style={{ height: 84, borderRadius: 10, background: 'linear-gradient(120deg,#a13b7a,#d4477f)', padding: 11, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: 64, height: 7, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
        <div style={{ marginTop: 8, width: 96, height: 14, borderRadius: 6, background: '#fff' }} />
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, height: 18, borderRadius: 6, border: '1.5px dashed rgba(255,255,255,.6)' }} />
          <div style={{ width: 42, height: 18, borderRadius: 6, background: '#fff' }} />
        </div>
        <div style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: 99, background: 'var(--surface)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 9 }}>
        <div style={{ width: 16, height: 5, borderRadius: 999, background: 'var(--accent)' }} />
        {[0, 1, 2].map((dot) => (
          <div key={dot} style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'gallery') return (
    <div style={{ ...shell, padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 8 }}>
        <div style={{ height: 88, gridRow: 'span 2', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent-soft),#fff)' }} />
        <div style={{ height: 40, borderRadius: 9, background: '#fce8d3' }} />
        <div style={{ height: 40, borderRadius: 9, background: '#dcf0e1' }} />
      </div>
      <div style={{ marginTop: 9, width: 110, height: 9, borderRadius: 999, background: 'var(--accent)' }} />
    </div>
  )
  return (
    <div style={{ ...shell, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} style={{ height: 28, borderRadius: 8, background: item === 0 ? 'var(--accent-soft)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
}

function previewFontCssValue(fontName: string, isDisplay = false) {
  if (SYSTEM_FONTS.has(fontName)) return fontName
  return isDisplay ? `"${fontName}", cursive` : `"${fontName}", sans-serif`
}
