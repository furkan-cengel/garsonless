import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

export function ComboRibbonSection({ config }: { config: Record<string, string> }) {
  const { text, number, targetHref } = makeReaders(config)
  const stripCurrency = (value: string) => value.replace(/^₺/, '')
  const comboCount = Math.min(3, Math.max(1, number('comboCount', 3)))
  const comboIcons = (prefix: string, fallback: string[]) => {
    const count = Math.min(3, Math.max(1, number(`${prefix}IconCount`, fallback.length)))
    return Array.from({ length: count }, (_, index) => text(`${prefix}Icon${index + 1}`, fallback[index] ?? fallback[0] ?? '☕'))
  }
  const combos = [
    {
      c: text('combo1Color', '#1cb6a8'),
      badge: {
        bg: text('combo1RibbonBg', '#ff3b1c'),
        fg: text('combo1RibbonText', '#fff'),
        l1: text('combo1RibbonTop', 'MEGA'),
        l2: text('combo1RibbonBottom', 'COMBO'),
      },
      icons: comboIcons('combo1', ['🍔', '🍟']),
      imageUrl: text('combo1ImageUrl', ''),
      off: text('combo1Badge', '-30%'),
      sub: text('combo1Title', 'Burger + Patates + İçecek'),
      price: text('combo1Price', '189'),
      old: text('combo1OldPrice', '270'),
    },
    {
      c: text('combo2Color', '#ff3b1c'),
      badge: {
        bg: text('combo2RibbonBg', '#ffc91a'),
        fg: text('combo2RibbonText', '#1c1d20'),
        l1: text('combo2RibbonTop', 'KAHVALTI'),
        l2: text('combo2RibbonBottom', 'COMBO'),
      },
      icons: comboIcons('combo2', ['☕', '🥐']),
      imageUrl: text('combo2ImageUrl', ''),
      off: text('combo2Badge', '-20%'),
      sub: text('combo2Title', 'Kahve + Kruvasan + Reçel'),
      price: text('combo2Price', '145'),
      old: text('combo2OldPrice', '180'),
    },
    {
      c: text('combo3Color', '#ffc91a'),
      badge: {
        bg: text('combo3RibbonBg', '#ff3b1c'),
        fg: text('combo3RibbonText', '#fff'),
        l1: text('combo3RibbonTop', 'TATLI'),
        l2: text('combo3RibbonBottom', 'COMBO'),
      },
      icons: comboIcons('combo3', ['🍰', '☕']),
      imageUrl: text('combo3ImageUrl', ''),
      off: text('combo3Badge', '-15%'),
      sub: text('combo3Title', 'Cheesecake + Filtre Kahve'),
      price: text('combo3Price', '165'),
      old: text('combo3OldPrice', '195'),
    },
  ].slice(0, comboCount)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        background: text('bgColor', '#fff3a8'),
        borderRadius: number('radius', 18),
        padding: 16,
      }}>
        <h3 style={{ margin: '0 0 12px', color: '#1c1d20', fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', paddingBottom: 4 }}>
          {text('title', '🔥 Komboları Kaçırma')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: number('cardGap', 14), paddingTop: 2 }}>
          {combos.map((combo, index) => (
            <div key={`${combo.sub}-${index}`} style={{
              background: combo.c,
              borderRadius: 14,
              padding: `${number('cardPadding', 16)}px 14px 14px`,
              position: 'relative',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 14px -6px rgba(0,0,0,.25)',
            }}>
              <div style={{
                position: 'absolute',
                top: -6,
                left: 14,
                background: combo.badge.bg,
                color: combo.badge.fg,
                padding: '5px 10px 8px',
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)',
                textAlign: 'center',
                lineHeight: 1,
              }}>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.05em' }}>{combo.badge.l1}</div>
                <div style={{ fontSize: 11, fontWeight: 900, marginTop: 1 }}>{combo.badge.l2}</div>
              </div>
              <div style={{
                width: combo.imageUrl ? number('imageSize', 52) : Math.max(106, number('imageSize', 52) * 2.05),
                minWidth: combo.imageUrl ? number('imageSize', 52) : Math.max(106, number('imageSize', 52) * 2.05),
                height: number('imageSize', 52),
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: combo.imageUrl ? Math.max(22, number('imageSize', 52) - 18) : Math.max(30, number('imageSize', 52) - 18),
                lineHeight: 1,
                whiteSpace: 'nowrap',
                letterSpacing: 0,
                overflow: 'visible',
              }}>
                {combo.imageUrl ? (
                  <img
                    src={combo.imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                    {combo.icons.map((icon, iconIndex) => (
                      <span key={`${icon}-${iconIndex}`} style={{ display: 'inline-block' }}>{icon}</span>
                    ))}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{combo.sub}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 950 }}>₺{stripCurrency(combo.price)}</span>
                  <span style={{ fontSize: 12, opacity: .7, textDecoration: 'line-through' }}>₺{stripCurrency(combo.old)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ background: 'rgba(255,255,255,.22)', borderRadius: 10, padding: '8px 6px', fontWeight: 900, fontSize: 16, lineHeight: 1 }}>{combo.off}</div>
                <a href={targetHref()} style={{ display: 'inline-flex', marginTop: 6, background: text('buttonBg', '#1c1d20'), color: text('buttonText', '#fff'), borderRadius: 99, padding: '5px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>{text('cta', 'Ekle')}</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
