import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

export function DiscountBadgeSection({ config }: { config: Record<string, string> }) {
  const { text, number } = makeReaders(config)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <style>{`
        @keyframes garsonless-badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: .9; }
        }
        @keyframes garsonless-product-float {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-5px) rotate(-8deg); }
        }
      `}</style>
      <div style={{
        minHeight: number('height', 156),
        borderRadius: number('radius', 18),
        background: text('bgColor', '#b5f53d'),
        color: text('textColor', '#5a0d1f'),
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {[[8, 6, 16], [88, 10, 11], [6, 68, 13], [90, 72, 18]].map(([x, y, size], index) => (
          <svg key={index} width={size} height={size} viewBox="0 0 12 12" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, color: text('textColor', '#5a0d1f') }}>
            <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" fill="currentColor" />
          </svg>
        ))}
        <div style={{
          border: `1.5px solid ${text('textColor', '#5a0d1f')}`,
          borderRadius: 18,
          padding: '20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
        }}>
          <div style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            flexShrink: 0,
            border: `1.5px solid ${text('textColor', '#5a0d1f')}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: text('textColor', '#5a0d1f'),
            lineHeight: 1,
            animation: 'garsonless-badge-pulse 2.4s ease-in-out infinite',
            background: text('bgColor', '#b5f53d'),
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em' }}>FALL</span>
            <span style={{ fontSize: 30, fontWeight: 900, margin: '3px 0' }}>{text('offer', '2x1')}</span>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em' }}>OFFER</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: text('textColor', '#5a0d1f'), letterSpacing: '.05em' }}>{text('eyebrow', 'SINIRLI SÜRE')}</div>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, fontWeight: 700, color: text('textColor', '#5a0d1f'), lineHeight: 1, margin: '6px 0' }}>
              {text('title', 'İkincisi bizden!')}
            </div>
            <div style={{ fontSize: 12, color: text('textColor', '#5a0d1f'), opacity: .8 }}>{text('body', 'Tüm hotdoglarda · 18:00’a kadar')}</div>
          </div>
        </div>
        <div style={{
          position: 'absolute',
          right: 24,
          top: 4,
          width: 64,
          height: 50,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #ff8b6b, #d97757)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          boxShadow: '0 6px 16px rgba(0,0,0,.2)',
          animation: 'garsonless-product-float 4s ease-in-out infinite',
        }}>
          {text('productIcon', '🌭')}
        </div>
      </div>
    </section>
  )
}
