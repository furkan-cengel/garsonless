'use client'

import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { THEME_REGISTRY } from '@garsonless/ui'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { I } from '../../lib/ui'

interface Props {
  restaurantId: string
  activeTemplateId: string
}

export default function ThemeLibraryClient({ restaurantId, activeTemplateId }: Props) {
  const router = useRouter()
  const activeId = THEME_REGISTRY[activeTemplateId] ? activeTemplateId : 'default'
  const activeEntry = THEME_REGISTRY[activeId] ?? THEME_REGISTRY['default']!
  const entries = [activeEntry]

  function handleCustomize(templateId: string) {
    router.push(`/dashboard/${restaurantId}/theme/${templateId}/edit`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'rgba(17, 17, 19, .48)',
      padding: 22,
      display: 'grid',
      placeItems: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 1220,
        height: 'calc(100vh - 44px)',
        maxHeight: 920,
        background: 'var(--surface)',
        borderRadius: 18,
        boxShadow: '0 42px 100px -28px rgba(0,0,0,.55)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div style={{
        padding: '20px 24px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 780, color: 'var(--text)' }}>
            Şablonlar
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.35, color: 'var(--text-3)' }}>
            1 hazır tasarım · aktif tasarımınız burada görünür
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 999,
          background: 'var(--surface-inset)',
          color: 'var(--text-2)',
          fontSize: 14,
          fontWeight: 650,
        }}>
          <span style={{
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontWeight: 850,
            letterSpacing: '.02em',
          }}>FREE</span>
          planındasın
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 24,
        background: 'var(--surface-inset)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 360px))',
        gap: 20,
        alignContent: 'start',
      }}>
        {entries.map((entry) => {
          const isActive = entry.id === activeId
          const t = entry.THEME_DEFAULTS

          return (
            <div
              key={entry.id}
              style={{
                background: 'var(--surface)',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
                boxShadow: isActive
                  ? '0 0 0 3px var(--accent-soft), 0 18px 42px rgba(20, 25, 31, 0.10)'
                  : '0 1px 2px rgba(20, 25, 31, 0.06)',
                position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 18,
                left: 18,
                zIndex: 3,
                height: 28,
                padding: '0 12px',
                borderRadius: 999,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 850,
                letterSpacing: '.02em',
              }}>
                FREE
              </div>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 18,
                  right: 18,
                  zIndex: 3,
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: '0 10px 24px rgba(20,25,31,.14)',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: '#fff' }} />
                  Aktif seçili
                </div>
              )}
              <ThemeCoverPreview id={entry.id} name={entry.name} theme={t} />

              <div style={{ padding: '16px 18px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.15, fontWeight: 820, color: 'var(--text)' }}>
                      {entry.name}
                    </h2>
                    <p style={{ margin: '7px 0 0', fontSize: 14, lineHeight: 1.35, color: 'var(--text-3)' }}>
                      Aktif menü tasarımınız
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {[t.bg, t.accentSoft, t.accent, t.cta].map((color, i) => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: color,
                      border: '1px solid rgba(0,0,0,0.08)',
                    }} />
                  ))}
                  </div>
                </div>

                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 18,
                }}>
                  <div style={{ minWidth: 0, color: 'var(--text-3)', fontSize: 14, lineHeight: 1.4 }}>
                    <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 6 }}><I.menu size={14} /></span>
                    {t.bodyFont} · {t.cols} kolon · {t.cardLayout === 'vertical' ? 'Kart görünümü' : 'Özel düzen'}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCustomize(entry.id)}
                    style={{
                      height: 44,
                      padding: '0 18px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--text)',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 760,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Özelleştir
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        padding: '14px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ color: 'var(--text-3)', fontSize: 14, lineHeight: 1.4 }}>
          <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 6, color: 'var(--accent)' }}><I.sparkles size={14} /></span>
          Yeni şablonlar eklendikçe bu alan otomatik dolacak; şimdilik aktif tasarımınız gösteriliyor.
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            height: 40,
            padding: '0 18px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 720,
            cursor: 'pointer',
          }}
        >
          Vazgeç
        </button>
      </div>
      </div>
    </div>
  )
}

export function ThemeCoverPreview({ id, name, theme }: { id: string; name: string; theme: GarsonlessTheme }) {
  if (id === 'spain') return <SpainThemePreview theme={theme} />
  if (id === 'default') return <ClassicThemePreview theme={theme} />
  return <GenericThemePreview name={name} theme={theme} />
}

function ClassicThemePreview({ theme }: { theme: GarsonlessTheme }) {
  const darkPreview = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <div style={{
      height: 360,
      background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.accentSoft} 100%)`,
      borderBottom: '1px solid rgba(20, 25, 31, 0.05)',
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
    }}>
      <div style={phoneMockStyle(darkPreview)}>
        <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid rgba(46,125,82,.12)', background: theme.headerBg }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontFamily: 'Georgia, serif', color: theme.accent, fontSize: 24, lineHeight: .92, fontWeight: 800 }}>
              MAF Cafe<br />Lounge
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: 9 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.cta }} />
                Masa 12
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: theme.accentSoft }} />
              <div style={{ width: 28, height: 28, borderRadius: 999, background: theme.accentSoft }} />
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 18px 72px', background: theme.bg }}>
          <div style={{
            borderRadius: 16,
            padding: 16,
            minHeight: 104,
            color: '#fff',
            background: `linear-gradient(135deg, ${theme.accent}, #dc7656)`,
            boxShadow: '0 18px 38px rgba(46,125,82,.18)',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>GÜN ÖZEL</div>
            <div style={{ marginTop: 10, fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1, fontWeight: 700 }}>MAF Cafe Lounge</div>
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.35, opacity: .92 }}>Favorilerinizi keşfedin, siparişinizi masanızdan oluşturun.</div>
            <div style={{
              marginTop: 13,
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 13px',
              borderRadius: 999,
              background: '#fff',
              color: theme.accent,
              fontSize: 10,
              fontWeight: 900,
            }}>Sipariş ver</div>
          </div>
          <div style={{ display: 'flex', gap: 10, overflow: 'hidden', marginBottom: 18 }}>
            {['Kahvaltı', 'İçecekler'].map((label, i) => (
              <div key={label} style={{
                position: 'relative',
                flex: '0 0 116px',
                height: 68,
                borderRadius: 14,
                overflow: 'hidden',
                background: i === 0 ? theme.accent : '#d9dce1',
                boxShadow: '0 10px 24px rgba(20,25,31,.10)',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: i === 0
                    ? `linear-gradient(180deg, rgba(20,25,31,.08), ${theme.accent})`
                    : 'linear-gradient(180deg, rgba(255,255,255,.2), rgba(20,25,31,.48))',
                }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', color: i === 0 ? '#f4d64f' : '#fff', fontSize: 12, fontWeight: 900 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', color: theme.accent, fontSize: 22, lineHeight: 1 }}>Kahvaltı</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniProductCard theme={theme} title="Serpme Kahvaltı" price="₺380" tone={theme.accentSoft} />
            <MiniProductCard theme={theme} title="Menemen" price="₺180" tone="#f7d89a" />
          </div>
        </div>
        <div style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 14,
          height: 34,
          borderRadius: 999,
          background: darkPreview ? '#fff' : '#1c1d20',
          color: darkPreview ? '#111' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          fontSize: 11,
          fontWeight: 850,
          boxShadow: '0 14px 28px rgba(20,25,31,.22)',
        }}>
          <span>Sepeti gör</span>
          <span>₺380</span>
        </div>
      </div>
    </div>
  )
}

function SpainThemePreview({ theme }: { theme: GarsonlessTheme }) {
  return (
    <div style={{
      height: 320,
      background: 'linear-gradient(145deg, #fdf9f4, #efe8df)',
      borderBottom: '1px solid rgba(20, 25, 31, 0.05)',
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      placeItems: 'center',
    }}>
      <div style={phoneMockStyle(false)}>
        <div style={{ padding: 12, borderBottom: '1px solid rgba(28,28,25,.08)', background: 'rgba(253,249,244,.86)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#111', display: 'inline-flex' }}><I.menu size={14} /></span>
            <span style={{ fontSize: 17, color: '#111', fontWeight: 850 }}>Taste of Spain</span>
            <span style={{ width: 20, height: 20, borderRadius: 999, background: '#e6e2dd', display: 'grid', placeItems: 'center', color: '#444748', fontSize: 10 }}>●</span>
          </div>
        </div>
        <div style={{ padding: '14px 14px 82px', background: theme.bg }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 7 }}>
              <SpainMenuTile label="A la carte" price="$180" bg="#d0e4ff" />
              <SpainMenuTile label="Wine menu" price="$83" bg="#ffdad2" />
            </div>
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#111', fontSize: 13, fontWeight: 850 }}>A la carte</h3>
          <SpainProductRow name="Tapas Platter" price="$24" bg="#d8b49a" />
          <SpainProductRow name="Paella" price="$38" bg="#c9d6bf" />
          <SpainProductRow name="Patatas" price="$12" bg="#e8c97d" />
        </div>
        <div style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 12,
          height: 38,
          borderRadius: 14,
          background: '#1c1c19',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          fontSize: 11,
          fontWeight: 850,
          boxShadow: '0 14px 28px rgba(20,25,31,.22)',
        }}>
          <span>Total Table 12</span>
          <span>$283</span>
        </div>
      </div>
    </div>
  )
}

function GenericThemePreview({ name, theme }: { name: string; theme: GarsonlessTheme }) {
  const darkPreview = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <div style={{
      height: 320,
      background: `linear-gradient(145deg, ${theme.bg}, ${theme.accentSoft})`,
      borderBottom: '1px solid rgba(20, 25, 31, 0.05)',
      position: 'relative',
      overflow: 'hidden',
      display: 'grid',
      placeItems: 'center',
    }}>
      <div style={phoneMockStyle(darkPreview)}>
        <div style={{ padding: 14, background: theme.headerBg, borderBottom: `1px solid ${darkPreview ? 'rgba(255,255,255,.08)' : 'rgba(20,25,31,.08)'}` }}>
          <div style={{ color: theme.accent, fontFamily: theme.displayFont.includes('Playfair') ? 'Georgia, serif' : 'inherit', fontSize: 22, lineHeight: 1, fontWeight: 850 }}>
            MAF Cafe
          </div>
        </div>
        <div style={{ padding: '12px 14px 80px', background: theme.bg }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 14, overflow: 'hidden' }}>
            {['Kahvaltı', 'Kahve', 'Tatlı'].map((label, index) => (
              <span key={label} style={{ flexShrink: 0, borderRadius: 999, padding: '7px 12px', background: index === 0 ? theme.accent : '#fff', color: index === 0 ? '#fff' : theme.accent, fontSize: 10, fontWeight: 850 }}>
                {label}
              </span>
            ))}
          </div>
          <h3 style={{ margin: '0 0 10px', color: theme.accent, fontSize: 14, fontWeight: 900 }}>{name}</h3>
          <MiniProductCard theme={theme} title="Signature Plate" price="₺240" tone={theme.accentSoft} />
          <div style={{ height: 10 }} />
          <MiniProductCard theme={theme} title="Chef Choice" price="₺180" tone={theme.cta} compact />
        </div>
      </div>
    </div>
  )
}

function phoneMockStyle(dark: boolean): CSSProperties {
  return {
    width: 248,
    height: 410,
    borderRadius: 34,
    border: dark ? '8px solid #0b0d12' : '8px solid #111',
    background: dark ? '#0b0d12' : '#fff',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 28px 60px rgba(20,25,31,.22)',
  }
}

function MiniProductCard({ theme, title, price, tone, compact = false }: { theme: GarsonlessTheme; title: string; price: string; tone: string; compact?: boolean }) {
  return (
    <div style={{
      height: compact ? 54 : 76,
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
      border: '1px solid rgba(20,25,31,.08)',
      boxShadow: '0 10px 22px rgba(20,25,31,.08)',
      display: compact ? 'grid' : 'block',
      gridTemplateColumns: compact ? '54px 1fr' : undefined,
    }}>
      <div style={{ height: compact ? '100%' : 34, background: `linear-gradient(135deg, ${tone}, ${theme.accent})`, opacity: .78 }} />
      <div style={{ padding: compact ? '9px 10px' : '8px 10px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: theme.accent, fontSize: compact ? 10 : 11, fontWeight: 850, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ color: '#15171c', fontSize: 10, fontWeight: 850, marginTop: 5 }}>{price}</div>
        </div>
        <div style={{ width: 22, height: 22, borderRadius: 999, background: theme.cta, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 900 }}>+</div>
      </div>
    </div>
  )
}

function SpainMenuTile({ label, price, bg }: { label: string; price: string; bg: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 10, background: bg, padding: 8, display: 'grid', alignContent: 'space-between' }}>
      <span style={{ color: '#111', fontSize: 10, lineHeight: 1, fontWeight: 850 }}>{label}</span>
      <span style={{ color: '#111', fontSize: 9, lineHeight: 1, fontWeight: 750, opacity: .56 }}>{price}</span>
    </div>
  )
}

function SpainProductRow({ name, price, bg }: { name: string; price: string; bg: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 8, padding: 6, borderRadius: 10, background: '#f7f3ee', marginBottom: 6 }}>
      <div style={{ borderRadius: 6, background: bg }} />
      <div style={{ display: 'grid', alignContent: 'center', gap: 4 }}>
        <span style={{ color: '#111', fontSize: 10, lineHeight: 1, fontWeight: 850 }}>{name}</span>
        <span style={{ color: '#747878', fontSize: 9, lineHeight: 1, fontWeight: 750 }}>{price}</span>
      </div>
    </div>
  )
}
