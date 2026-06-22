import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

export function HeroSection({
  sectionId,
  config,
  restaurantName,
  pageDescription,
}: {
  sectionId: string
  config: Record<string, string>
  restaurantName: string
  pageDescription?: string | undefined
}) {
  const { text, number, targetHref } = makeReaders(config)
  const imageUrl = text('imageUrl', '')
  const imageMode = text('imageMode', 'background')
  const bgStart = text('bgStart', 'var(--p-accent)')
  const bgEnd = text('bgEnd', '#d97757')
  const textColor = text('textColor', sectionId === 'hero-banner' ? '#ffffff' : 'var(--p-text)')
  const overlay = number('overlay', imageUrl ? 25 : 0) / 100
  const align = text('align', 'left') as 'left' | 'center' | 'right'
  const heroBackground = imageUrl && imageMode === 'background'
    ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${imageUrl}") center/cover`
    : sectionId === 'hero-banner'
      ? `linear-gradient(135deg, ${bgStart}, ${bgEnd})`
      : 'linear-gradient(135deg, var(--p-accent-soft), rgba(255,255,255,.72))'
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        minHeight: number('height', 164),
        borderRadius: text('radius', '') ? number('radius', 16) : 'calc(var(--p-radius) + 4px)',
        background: heroBackground,
        border: 'var(--p-border-w) solid var(--p-border)',
        padding: number('padding', 18),
        color: textColor,
        position: 'relative',
        overflow: 'hidden',
        textAlign: align,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}>
        {imageUrl && imageMode === 'side' && (
          <img
            alt=""
            src={imageUrl}
            style={{
              position: 'absolute',
              right: -18,
              bottom: -18,
              width: '42%',
              height: '78%',
              objectFit: 'cover',
              borderRadius: 28,
              opacity: 0.92,
            }}
          />
        )}
        <p style={{
          margin: '0 0 8px',
          color: sectionId === 'hero-banner' ? textColor : 'var(--p-accent)',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          position: 'relative',
          zIndex: 1,
          opacity: 0.82,
        }}>
          {text('eyebrow', sectionId === 'hero-banner' ? 'Gün özel' : 'Hoş geldiniz')}
        </p>
        <h2 style={{
          margin: 0,
          color: textColor,
          fontFamily: 'var(--p-display)',
          fontSize: 'calc(var(--p-fs) + 10px)',
          lineHeight: 1.08,
          position: 'relative',
          zIndex: 1,
        }}>
          {text('title', restaurantName)}
        </h2>
        <p style={{
          margin: '10px 0 0',
          color: sectionId === 'hero-banner' ? textColor : 'var(--p-text-2)',
          fontSize: 'var(--p-fs)',
          lineHeight: 'calc(var(--p-lh) * 1em)',
          position: 'relative',
          zIndex: 1,
          maxWidth: 280,
          opacity: 0.82,
        }}>
          {text('body', pageDescription || 'Favorilerinizi keşfedin, siparişinizi masanızdan kolayca oluşturun.')}
        </p>
        {sectionId === 'hero-banner' && (
          <a href={targetHref()} style={{
            marginTop: 16,
            border: 'none',
            borderRadius: 999,
            background: text('buttonBg', '#ffffff'),
            color: text('buttonText', 'var(--p-accent)'),
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 900,
            textDecoration: 'none',
            position: 'relative',
            zIndex: 1,
          }}>
            {text('cta', 'Sipariş ver')}
          </a>
        )}
      </div>
    </section>
  )
}
