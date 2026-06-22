const LOGOS = [
  { name: 'Acımarka',    style: 'script' },
  { name: 'MAF CAFE',    style: 'bold' },
  { name: 'Petra Coffee', style: 'serif' },
  { name: 'Kahve&Co',    style: 'mono' },
  { name: 'Mor Köşe',    style: 'script' },
  { name: 'Northside',   style: 'bold' },
  { name: 'Frenk',       style: 'serif' },
  { name: 'Bardak Bey',  style: 'mono' },
]

const LOGO_STYLES: Record<string, React.CSSProperties> = {
  script: { fontFamily: 'Pacifico, cursive', fontSize: 22, letterSpacing: 0 },
  bold:   { fontFamily: 'Geist, sans-serif', fontSize: 19, fontWeight: 800, letterSpacing: '.08em' },
  serif:  { fontFamily: 'Fraunces, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 500 },
  mono:   { fontFamily: 'Geist Mono, monospace', fontSize: 17, fontWeight: 600, letterSpacing: '-.02em' },
}

const logoRow = [...LOGOS, ...LOGOS]

export function LogoStrip() {
  return (
    <section style={{ padding: '40px 0 80px', background: 'var(--bg)' }}>
      <div className="container">
        <div style={{
          textAlign: 'center', marginBottom: 28, fontSize: 13,
          color: 'var(--ink-3)', fontWeight: 500, letterSpacing: '.04em',
        }}>
          Türkiye&apos;de <strong style={{ color: 'var(--ink)' }}>2 400+ mekan</strong> tarafından kullanılıyor
        </div>
        <div style={{
          position: 'relative', overflow: 'hidden',
          maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        }}>
          <div style={{
            display: 'flex', gap: 56, width: 'max-content',
            animation: 'marquee 30s linear infinite',
          }}>
            {logoRow.map((l, i) => (
              <span key={i} style={{
                ...(LOGO_STYLES[l.style] ?? {}),
                color: 'var(--ink-3)', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', height: 36,
              }}>{l.name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
