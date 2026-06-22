const STATS = [
  { value: '2 400+', label: 'aktif mekan' },
  { value: '28',     label: 'şehir' },
  { value: '18M+',   label: 'aylık sipariş' },
  { value: '%99.98', label: 'uptime' },
]

export function StatsBar() {
  return (
    <section style={{ padding: '60px 0', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, maxWidth: 860, margin: '0 auto' }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div className="font-display" style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--brand)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
