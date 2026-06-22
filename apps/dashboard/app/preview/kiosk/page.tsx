'use client'

// ── palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#fff8f0',
  orange:  '#e84c0a',
  dark:    '#1a1a1a',
  muted:   '#999',
  divider: 'rgba(0,0,0,0.07)',
}

// ── data ───────────────────────────────────────────────────────────────────────
const CATEGORIES = ['Döner', 'Lahmacun', 'Pide', 'İçecek', 'Tatlı']

const SECTIONS = [
  {
    title: 'DÖNER',
    items: [
      { name: 'Dürüm Döner',  desc: 'Tavuk, marul, domates', price: 85  },
      { name: 'Ekmek Arası',  desc: 'Karışık, soğan, sos',   price: 75  },
      { name: 'Tabak Döner',  desc: 'Pilav, salata',          price: 120 },
    ],
  },
  {
    title: 'LAHMACUN',
    items: [
      { name: 'Sade Lahmacun', desc: 'İnce hamur, kıyma',  price: 45 },
      { name: 'Acılı Lahmacun',desc: 'Harissa, kıyma',      price: 50 },
      { name: 'Dürüm Lahmacun',desc: 'Maydanoz, limon',     price: 65 },
    ],
  },
]

// ── tiny SVG icons ─────────────────────────────────────────────────────────────
function SignalBars() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill={C.dark}>
      <rect x="0"  y="7"  width="3" height="5" rx="0.8" />
      <rect x="4.5"y="4.5"width="3" height="7.5" rx="0.8" />
      <rect x="9"  y="2"  width="3" height="10" rx="0.8" />
      <rect x="13.5" y="0" width="3" height="12" rx="0.8" />
    </svg>
  )
}

function WifiBars() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke={C.dark} strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 4.5 C4-1.5 12-1.5 15 4.5" />
      <path d="M3.5 7 C5.2 4 10.8 4 12.5 7" />
      <circle cx="8" cy="10.5" r="1.2" fill={C.dark} stroke="none"/>
    </svg>
  )
}

function BatteryIcon() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={C.dark} strokeWidth="1.2" />
      <rect x="22.5" y="3.5" width="2" height="5" rx="1" fill={C.dark} />
      <rect x="2" y="2" width="16" height="8" rx="2" fill={C.dark} />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272" />
      <circle cx="9"  cy="20" r="1" fill="#fff" stroke="none" />
      <circle cx="17" cy="20" r="1" fill="#fff" stroke="none" />
    </svg>
  )
}

// ── sub-components ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      padding: '14px 16px 2px',
      fontSize: 10.5, fontWeight: 800, color: C.orange,
      letterSpacing: '0.14em',
      fontFamily: 'inherit',
    }}>{children}</div>
  )
}

function MenuItem({ name, desc, price, first }: { name: string; desc: string; price: number; first?: boolean }) {
  const initial = name[0] ?? '?'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '11px 16px',
      borderTop: first ? undefined : `1px solid ${C.divider}`,
      minHeight: 72,
      background: C.bg,
    }}>
      {/* circular thumbnail */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        background: C.orange,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 20,
        fontFamily: 'inherit',
        boxShadow: '0 3px 10px rgba(232,76,10,0.28)',
      }}>{initial}</div>

      {/* name + desc */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: C.dark,
          lineHeight: 1.2, fontFamily: 'inherit',
        }}>{name}</div>
        <div style={{
          fontSize: 12, color: C.muted, marginTop: 3,
          fontFamily: 'inherit',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{desc}</div>
      </div>

      {/* price (hero) + add button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{
          fontSize: 22, fontWeight: 800, color: C.orange,
          fontFamily: 'inherit', lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>₺{price}</span>
        <button
          type="button"
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: C.orange, border: 'none', color: '#fff',
            fontSize: 20, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(232,76,10,0.4)',
            flexShrink: 0, fontFamily: 'inherit',
          }}
        >+</button>
      </div>
    </div>
  )
}

// ── phone frame ────────────────────────────────────────────────────────────────
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* volume up */}
      <div style={{ position: 'absolute', left: -3, top: 128, width: 3, height: 30, background: '#2a2a2a', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', left: -3, top: 168, width: 3, height: 30, background: '#2a2a2a', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.4)' }} />
      {/* mute switch */}
      <div style={{ position: 'absolute', left: -3, top: 96,  width: 3, height: 22, background: '#2a2a2a', borderRadius: '2px 0 0 2px', boxShadow: '-1px 0 2px rgba(0,0,0,0.4)' }} />
      {/* power */}
      <div style={{ position: 'absolute', right: -3, top: 158, width: 3, height: 62, background: '#2a2a2a', borderRadius: '0 2px 2px 0', boxShadow: '1px 0 2px rgba(0,0,0,0.4)' }} />

      {/* bezel */}
      <div style={{
        width: 406,
        background: 'linear-gradient(160deg, #2c2c2c 0%, #1a1a1a 60%, #111 100%)',
        borderRadius: 54,
        padding: 10,
        boxShadow: [
          'inset 0 0 0 1px rgba(255,255,255,0.08)',
          '0 0 0 1px #0a0a0a',
          '0 40px 100px rgba(0,0,0,0.8)',
          '0 0 60px rgba(232,76,10,0.06)',
        ].join(', '),
      }}>
        {/* screen */}
        <div style={{
          background: C.bg,
          borderRadius: 46,
          overflow: 'hidden',
          height: 856,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── main menu screen ───────────────────────────────────────────────────────────
function MenuScreen() {
  return (
    <>
      {/* iOS status bar */}
      <div style={{
        height: 58, background: C.bg, flexShrink: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '0 28px 10px',
        position: 'relative',
      }}>
        {/* dynamic island */}
        <div style={{
          position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)',
          width: 124, height: 36, background: '#000',
          borderRadius: 999,
          boxShadow: '0 0 0 2px #1a1a1a',
        }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: 'inherit' }}>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SignalBars />
          <WifiBars />
          <BatteryIcon />
        </div>
      </div>

      {/* scrollable area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        scrollbarWidth: 'none' as const,
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── HEADER STRIP ─────────────────────────────── */}
        <div style={{
          height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          background: C.bg,
          position: 'sticky', top: 0, zIndex: 20,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', color: C.dark,
            textTransform: 'uppercase' as const, fontFamily: 'inherit',
          }}>KIOSK</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* green open dot */}
            <div style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 5px rgba(34,197,94,0.6)' }} />
          </div>
        </div>

        {/* ── CATEGORY NAV ─────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, padding: '10px 16px',
          overflowX: 'auto', scrollbarWidth: 'none' as const,
          background: C.bg,
          position: 'sticky', top: 38, zIndex: 10,
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(255,248,240,0.9)',
        }}>
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat}
              type="button"
              style={{
                flexShrink: 0,
                padding: '6px 16px',
                borderRadius: 999,
                fontSize: 13, fontWeight: 700,
                background: i === 0 ? C.orange : 'transparent',
                color: i === 0 ? '#fff' : C.dark,
                border: `1.5px solid ${C.orange}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* ── MENU SECTIONS ────────────────────────────── */}
        {SECTIONS.map((section, si) => (
          <section key={section.title} style={{ marginTop: si > 0 ? 10 : 0 }}>
            <SectionLabel>{section.title}</SectionLabel>
            {section.items.map((item, ii) => (
              <MenuItem key={item.name} {...item} first={ii === 0} />
            ))}
          </section>
        ))}

        {/* spacer for sticky bottom bar */}
        <div style={{ flexGrow: 1, minHeight: 80, background: C.bg }} />
      </div>

      {/* ── STICKY BOTTOM BAR ────────────────────────── */}
      <div style={{
        height: 56, background: C.dark, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 14px',
        position: 'relative',
      }}>
        {/* left: cart icon + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CartIcon />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}>2 ürün</span>
        </div>

        {/* center: CTA text */}
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 14.5, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap' as const,
        }}>Siparişi Tamamla</span>

        {/* right: price badge */}
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            background: C.orange, color: '#fff',
            borderRadius: 8, padding: '5px 13px',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
            boxShadow: '0 2px 10px rgba(232,76,10,0.45)',
          }}>₺215</span>
        </div>
      </div>
    </>
  )
}

// ── page ───────────────────────────────────────────────────────────────────────
export default function KioskPreviewPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', system-ui, sans-serif; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at 30% 60%, #1a0800 0%, #0a0a0a 60%, #0f0f15 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: "'Nunito', system-ui, sans-serif",
      }}>
        {/* subtle orange glow behind phone */}
        <div style={{
          position: 'fixed',
          width: 400, height: 600,
          background: 'radial-gradient(circle, rgba(232,76,10,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <PhoneFrame>
          <MenuScreen />
        </PhoneFrame>
      </div>
    </>
  )
}
