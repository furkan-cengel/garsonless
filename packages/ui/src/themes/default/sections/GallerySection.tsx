import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

export function GallerySection({ config }: { config: Record<string, string> }) {
  const { text, number } = makeReaders(config)
  const FALLBACKS = [
    { gradient: 'linear-gradient(135deg, #f5dcea, #fce8d3)', icon: '🪑' },
    { gradient: 'linear-gradient(135deg, #dcf0e1, #cfe8f8)', icon: '☕' },
    { gradient: 'linear-gradient(135deg, #fde7c2, #fbd3c1)', icon: '🥐' },
    { gradient: 'linear-gradient(135deg, #e7e3f0, #f5dcea)', icon: '🌿' },
    { gradient: 'linear-gradient(135deg, #fce8d3, #fde7c2)', icon: '🍰' },
    { gradient: 'linear-gradient(135deg, #cfe8f8, #dcf0e1)', icon: '🍵' },
  ]
  const tiles = [
    { key: 'tile1Image', labelKey: 'tile1Label', span: 2, fb: FALLBACKS[0]! },
    { key: 'tile2Image', labelKey: 'tile2Label', span: 1, fb: FALLBACKS[1]! },
    { key: 'tile3Image', labelKey: 'tile3Label', span: 1, fb: FALLBACKS[2]! },
    { key: 'tile4Image', labelKey: 'tile4Label', span: 1, fb: FALLBACKS[3]! },
    { key: 'tile5Image', labelKey: 'tile5Label', span: 1, fb: FALLBACKS[4]! },
    { key: 'tile6Image', labelKey: 'tile6Label', span: 1, fb: FALLBACKS[5]! },
  ]
  const hepsiUrl = text('targetUrl', '') || (text('targetType', 'none') !== 'none' ? '#' : '')
  const accentColor = text('accentColor', 'var(--p-accent)')
  const tileRadius = number('radius', 12)
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{ background: 'var(--p-card)', borderRadius: number('radius', 18), padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: accentColor, fontFamily: 'var(--p-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {text('title', 'Mekândan Kareler')}
          </h3>
          {hepsiUrl && (
            <a
              href={hepsiUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: accentColor, fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
            >
              Hepsi →
            </a>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoRows: 84, gap: 8 }}>
          {tiles.map((tile) => {
            const imgUrl = text(tile.key, '')
            const label = text(tile.labelKey, '')
            return (
              <div
                key={tile.key}
                style={{
                  gridColumn: tile.span === 2 ? 'span 2' : 'auto',
                  borderRadius: tileRadius,
                  position: 'relative',
                  overflow: 'hidden',
                  background: imgUrl ? `url("${imgUrl}") center/cover` : tile.fb.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: tile.span === 2 ? 40 : 28,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
                }}
              >
                {!imgUrl && <span>{tile.fb.icon}</span>}
                {label && (
                  <div style={{
                    position: 'absolute', left: 10, bottom: 10,
                    background: 'rgba(255,255,255,.85)',
                    backdropFilter: 'blur(6px)',
                    padding: '4px 9px', borderRadius: 7,
                    fontSize: 10.5, fontWeight: 600,
                    color: accentColor,
                  }}>{label}</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--p-text-2)' }}>
          <span style={{ fontSize: 14 }}>📷</span>
          <span>{text('body', "@restoran · Instagram'da paylaş")}</span>
        </div>
      </div>
    </section>
  )
}
