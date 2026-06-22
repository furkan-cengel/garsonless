import { makeReaders } from '../lib/sectionHelpers'

export function PromoStripSection({ config }: { config: Record<string, string> }) {
  const { text, number, bool, targetHref } = makeReaders(config)
  const message = text('title', 'İLK SİPARİŞE %20 İNDİRİM')
  const repeatText = text('repeatText', 'BUGÜNE ÖZEL · MASADAN HIZLI SİPARİŞ')
  const animation = text('animation', 'marquee')
  const direction = text('direction', 'right')
  const speed = number('speed', 18)
  const animationName = animation === 'marquee'
    ? direction === 'left' ? 'garsonless-promo-marquee-left' : 'garsonless-promo-marquee-right'
    : animation === 'fade' ? 'garsonless-promo-fade' : undefined
  return (
    <section data-component="custom-section" style={{ padding: '14px 0 2px' }}>
      <style>{`
        @keyframes garsonless-promo-marquee-left {
          from { transform: translateX(0); }
          to { transform: translateX(50%); }
        }
        @keyframes garsonless-promo-marquee-right {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes garsonless-promo-fade {
          0%, 100% { opacity: .72; }
          50% { opacity: 1; }
        }
        .garsonless-promo-track.is-pausable:hover {
          animation-play-state: paused;
        }
      `}</style>
      <a
        href={targetHref()}
        style={{
          height: number('height', 38),
          background: text('bgColor', 'var(--p-text)'),
          color: text('textColor', '#ffd089'),
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: '0.04em',
          textDecoration: 'none',
        }}
      >
        <span
          className={`garsonless-promo-track ${bool('pauseOnHover') ? 'is-pausable' : ''}`}
          style={{
            display: 'inline-flex',
            minWidth: animation === 'marquee' ? '200%' : undefined,
            gap: 26,
            paddingLeft: 16,
            color: text('textColor', '#ffd089'),
            animation: animationName ? `${animationName} ${speed}s linear infinite` : undefined,
          }}
        >
          {[0, 1, 2, 3].map((item) => (
            <span key={item}>
              <span style={{ color: text('accentColor', '#ffffff') }}>{message}</span>
              <span> · {repeatText}</span>
            </span>
          ))}
        </span>
      </a>
    </section>
  )
}
