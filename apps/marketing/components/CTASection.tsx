import { MI } from '../lib/icons'
import { PrimaryButton } from './ui/Buttons'
import { Eyebrow } from './ui/Eyebrow'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

export function CTASection() {
  return (
    <section style={{ padding: '0 32px', background: 'var(--bg)' }}>
      <div className="grain" style={{
        maxWidth: 1176, margin: '0 auto',
        background: 'var(--night)', borderRadius: 32, padding: '80px 64px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.15), transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,.13), transparent 65%)' }} />
        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 720, margin: '0 auto', color: '#fff' }}>
          <Eyebrow tone="ink">14 gün ücretsiz</Eyebrow>
          <h2 className="font-display" style={{
            fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em',
            lineHeight: 1.05, margin: '20px 0 0',
          }}>
            Bugün başlayın.<br />
            <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>Yarın garsonsuz</em> olun.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.65)', marginTop: 24, lineHeight: 1.5 }}>
            Kart bilgisi yok. Kurulum 2 dakika. İlk siparişiniz bugün düşsün.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
            <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none' }}>
              <PrimaryButton dark size="lg">14 gün ücretsiz dene <MI.arrow /></PrimaryButton>
            </a>
            <a href="/company#iletişim" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '14px 22px', fontSize: 15.5, fontWeight: 600, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Demo görüşme planla
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
