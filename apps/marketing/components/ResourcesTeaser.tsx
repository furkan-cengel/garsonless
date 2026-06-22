'use client'

import { MI } from '../lib/icons'
import { Eyebrow } from './ui/Eyebrow'

const POSTS = [
  { tag: 'Rehber',  read: '6 dk', title: 'QR menüden gerçek satışa: 7 adımda kurulum', tint: '#fce8d3' },
  { tag: 'Vaka',    read: '4 dk', title: 'MAF Cafe nasıl %24 ciro artışı sağladı?',     tint: '#dcf0e1' },
  { tag: 'Tasarım', read: '8 dk', title: 'Müşteriyi sipariş ekranında tutan 5 prensip',  tint: '#f5dcea' },
]

function PostCard({ post }: { post: typeof POSTS[0] }) {
  return (
    <a
      href="/resources#blog"
      style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column', transition: 'transform 200ms ease, box-shadow 200ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px -12px rgba(28,24,20,.15)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ height: 180, background: post.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg viewBox="0 0 200 100" width="60%" style={{ opacity: .4 }}>
          <circle cx="50" cy="50" r="30" fill="var(--ink)" />
          <rect x="100" y="30" width="80" height="6" fill="var(--ink)" rx="3" />
          <rect x="100" y="46" width="60" height="6" fill="var(--ink)" rx="3" opacity=".6" />
          <rect x="100" y="62" width="70" height="6" fill="var(--ink)" rx="3" opacity=".3" />
        </svg>
        <span style={{ position: 'absolute', top: 14, left: 14, padding: '4px 10px', borderRadius: 999, background: '#fff', color: 'var(--ink)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{post.tag}</span>
      </div>
      <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="font-display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.015em', lineHeight: 1.25, margin: 0, flex: 1 }}>{post.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--ink-4)' }} />
          {post.read} okuma
        </div>
      </div>
    </a>
  )
}

export function ResourcesTeaser() {
  return (
    <section id="kaynaklar" style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Eyebrow tone="warm">Blog & Kaynaklar</Eyebrow>
            <h2 className="font-display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '16px 0 0', color: 'var(--ink)' }}>
              Daha iyi bir mekan, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>daha iyi okuyarak</em>.
            </h2>
          </div>
          <a href="/resources" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', padding: '10px 18px', border: '1.5px solid var(--ink)', borderRadius: 999 }}>
            Tüm yazılar <MI.arrow size={15} />
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {POSTS.map((p, i) => <PostCard key={i} post={p} />)}
        </div>
      </div>
    </section>
  )
}
