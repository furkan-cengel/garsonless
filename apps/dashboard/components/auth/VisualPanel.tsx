import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { I } from '../../lib/ui'

interface Props {
  mode: 'login' | 'signup'
}

function FloatingChip({
  icon, label, price, tag, rot = 0, delay = 0,
}: {
  icon: ReactNode; label: string; price: string; tag?: string; rot?: number; delay?: number
}): ReactElement {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: 10, display: 'flex', alignItems: 'center', gap: 10,
      '--rot': `${rot}deg`,
      animation: `float 5s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      boxShadow: '0 20px 50px -15px rgba(0,0,0,.4)',
      color: 'var(--ink)',
    } as CSSProperties}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: 'linear-gradient(135deg, #fce8d3, #fbd3c1)',
        color: '#7a3a1f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700 }}>{price}</span>
          {tag && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 99,
              background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 700,
            }}>{tag}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VisualPanel({ mode }: Props): ReactElement {
  const isLogin = mode === 'login'

  return (
    <aside className="auth-visual-panel" style={{
      width: '46%', minWidth: 480,
      background: 'var(--night)', color: '#fff',
      padding: '40px 48px',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', top: -100, right: -100, width: 480, height: 480,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,208,137,.16), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -120, left: -80, width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,.13), transparent 65%)',
        pointerEvents: 'none',
      }} />
      {/* Noise grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E")`,
        opacity: .04, mixBlendMode: 'overlay',
      }} />

      {/* Logo */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, zIndex: 1 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: '#ffd089', color: '#1a1612',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: 19, lineHeight: 1,
        }}>g</div>
        <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }}>garsonless</span>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', position: 'relative', zIndex: 1,
      }}>
        {/* Live badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,208,137,.15)', color: 'var(--accent-2)',
          fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent-2)' }} />
          2 400+ mekan kullanıyor
        </span>

        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 500,
          letterSpacing: '-0.03em', lineHeight: 1.05, margin: '24px 0 0', color: '#fff',
        }}>
          {isLogin ? 'Kafenize tekrar' : 'Kafenizi 2 dakikada'}<br />
          <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>
            {isLogin ? 'hoş geldiniz.' : 'akıllandırın.'}
          </em>
        </h1>

        <p style={{ fontSize: 17, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, marginTop: 18, maxWidth: 460 }}>
          {isLogin
            ? 'Siparişler düşmeye devam etti, ekibiniz işine baktı. Hadi panonuza geri dönelim.'
            : 'Garsonsuz değil, garson dertsiz. 14 gün ücretsiz · kart gerekmez · iptal 1 tık.'}
        </p>

        {/* Testimonial */}
        <div style={{
          marginTop: 36, padding: 22,
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 16, maxWidth: 460,
        }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ color: 'var(--accent-2)', display: 'inline-flex' }}><I.star size={15} fill="currentColor" /></span>
            ))}
          </div>
          <blockquote style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 18, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.45,
            margin: 0, color: '#fff',
          }}>
            &ldquo;Açtığımız ilk hafta personel 3 kişiydi, şimdi 2. Müşteri memnuniyeti arttı, biz daha çok mutfakla ilgileniyoruz.&rdquo;
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              background: 'linear-gradient(135deg, #ffd089, #ff8b6b)',
              color: 'var(--night)', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>DA</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Defne Aksoy</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>MAF Cafe Lounge · Kurucu</div>
            </div>
            <div style={{
              marginLeft: 'auto', padding: '5px 10px',
              background: 'rgba(94,232,164,.15)', color: '#5ee8a4',
              borderRadius: 99, fontSize: 11,
              fontFamily: "'Geist Mono', monospace", fontWeight: 700,
              flexShrink: 0,
            }}>
              −38% sipariş süresi
            </div>
          </div>
        </div>

        {/* Floating chips */}
        <div style={{ position: 'absolute', right: -20, top: 40, width: 200, opacity: .9 }}>
          <FloatingChip icon={<I.cutlery size={22} />} label="Serpme Kahvaltı" price="₺380" tag="Popüler" rot={-3} delay={0} />
        </div>
        <div style={{ position: 'absolute', right: -10, bottom: 80, width: 180 }}>
          <FloatingChip icon={<I.stamp size={22} />} label="Türk Kahvesi" price="₺75" rot={4} delay={1.5} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', gap: 24, fontSize: 12,
        color: 'rgba(255,255,255,.55)', flexWrap: 'wrap',
      }}>
        <span>← Ana sayfaya dön</span>
        <span>•</span>
        <a href="#" style={{ color: 'rgba(255,255,255,.55)', textDecoration: 'none' }}>Gizlilik</a>
        <a href="#" style={{ color: 'rgba(255,255,255,.55)', textDecoration: 'none' }}>Şartlar</a>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999, background: '#5ee8a4',
            animation: 'pulse-soft 1.8s infinite',
            display: 'inline-block',
          }} />
          Tüm sistemler operasyonel
        </span>
      </div>
    </aside>
  )
}
