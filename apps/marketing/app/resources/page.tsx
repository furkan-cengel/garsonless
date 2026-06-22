import { MI } from '../../lib/icons'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { SectionHead } from '../../components/ui/SectionHead'
import { PrimaryButton } from '../../components/ui/Buttons'
import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { CTASection } from '../../components/CTASection'

const POSTS = [
  { tag: 'Rehber',    read: '6 dk', title: 'QR menüden gerçek satışa: 7 adımda kurulum',    tint: '#fce8d3', date: '12 May 2026', feat: true },
  { tag: 'Vaka',      read: '4 dk', title: 'MAF Cafe nasıl %24 ciro artışı sağladı?',        tint: '#dcf0e1', date: '8 May 2026' },
  { tag: 'Tasarım',   read: '8 dk', title: 'Müşteriyi sipariş ekranında tutan 5 prensip',    tint: '#f5dcea', date: '4 May 2026' },
  { tag: 'Operasyon', read: '5 dk', title: 'Mutfak ekranı kuyruğunu nasıl yönetmeli?',       tint: '#cfe8f8', date: '28 Nis 2026' },
  { tag: 'Strateji',  read: '7 dk', title: 'Menü mühendisliği: hangi ürün kalmalı?',          tint: '#fde7c2', date: '22 Nis 2026' },
  { tag: 'Trend',     read: '3 dk', title: '2026 yiyecek-içecek trendleri raporu',            tint: '#fbeee2', date: '18 Nis 2026' },
]

type Post = typeof POSTS[0]

function PostCardBig({ post }: { post: Post }) {
  return (
    <a href="#" style={{ background: 'var(--surface)', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 280, background: post.tint, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', top: 16, left: 16, padding: '4px 10px', borderRadius: 99, background: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{post.tag}</span>
        <span style={{ fontSize: 72, opacity: .25 }}>📖</span>
      </div>
      <div style={{ padding: '22px 24px' }}>
        <h3 className="font-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2, margin: 0 }}>{post.title}</h3>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10 }}>{post.date} · {post.read} okuma</div>
      </div>
    </a>
  )
}

function PostCardCompact({ post }: { post: Post }) {
  return (
    <a href="#" style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', display: 'flex', gap: 14, padding: 14 }}>
      <div style={{ width: 80, height: 80, borderRadius: 10, background: post.tint, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: 'var(--bg-2)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em' }}>{post.tag}</span>
        <div className="font-display" style={{ fontSize: 17, fontWeight: 600, marginTop: 6, lineHeight: 1.25 }}>{post.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>{post.date} · {post.read} okuma</div>
      </div>
    </a>
  )
}

function PostCard({ post }: { post: Post }) {
  return (
    <a href="#" style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
      <div style={{ height: 160, background: post.tint }} />
      <div style={{ padding: '16px 18px' }}>
        <span style={{ padding: '2px 8px', borderRadius: 99, background: 'var(--bg-2)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em' }}>{post.tag}</span>
        <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, marginTop: 8, lineHeight: 1.3 }}>{post.title}</h3>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>{post.date} · {post.read}</div>
      </div>
    </a>
  )
}

function HeroResources() {
  return (
    <section style={{ padding: '80px 0 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -200, right: -100, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,208,137,.18), transparent 65%)', pointerEvents: 'none' }} />
      <div className="container" style={{ position: 'relative', maxWidth: 880 }}>
        <Eyebrow tone="warm">Kaynaklar</Eyebrow>
        <h1 className="font-display" style={{ fontSize: 'clamp(44px, 5.5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 0' }}>
          Daha iyi bir mekan,<br />
          <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>daha iyi okuyarak</em>.
        </h1>
        <p style={{ fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.55, margin: '22px auto 0', maxWidth: 580 }}>
          Yazılar, vakalar, dokümantasyon ve şablonlar — hepsi tek çatı altında.
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'var(--surface)', border: '1.5px solid var(--line)', borderRadius: 999, width: '100%', maxWidth: 480, boxShadow: '0 4px 14px -4px rgba(0,0,0,.06)' }}>
            <span style={{ color: 'var(--ink-3)', display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>
            </span>
            <input placeholder="Yardım, makale veya şablon ara..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15 }} />
            <span style={{ fontFamily: 'Geist Mono', fontSize: 11, color: 'var(--ink-3)', padding: '2px 6px', background: 'var(--bg-2)', borderRadius: 4 }}>⌘K</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function BlogSection() {
  const filters = ['Tümü', 'Rehber', 'Vaka', 'Tasarım', 'Strateji']
  return (
    <section id="blog" style={{ padding: '60px 0 80px', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Eyebrow tone="warm">Blog</Eyebrow>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 500, letterSpacing: '-0.025em', margin: '16px 0 0' }}>Son yazılar</h2>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {filters.map((t, i) => (
              <span key={t} style={{ padding: '6px 12px', borderRadius: 999, background: i === 0 ? 'var(--ink)' : 'transparent', color: i === 0 ? '#fff' : 'var(--ink-2)', border: i === 0 ? 'none' : '1px solid var(--line)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 }}>
          <PostCardBig post={POSTS[0]!} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {POSTS.slice(1, 3).map(p => <PostCardCompact key={p.title} post={p} />)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {POSTS.slice(3).map(p => <PostCard key={p.title} post={p} />)}
        </div>
      </div>
    </section>
  )
}

function CaseStudies() {
  const cases = [
    { name: 'MAF Cafe Lounge',       metric: '+%24',  label: 'Ciro artışı',                        tint: '#fce8d3', period: '3 ay' },
    { name: 'Mezzogiorno',            metric: '−38%',  label: 'Sipariş süresi',                     tint: '#dcf0e1', period: '2 ay' },
    { name: 'Kahveci Mustafa Amca',  metric: '12→1',  label: 'Şube yönetimi (gün → saat)',          tint: '#fbeee2', period: '6 ay' },
  ]
  return (
    <section id="vaka" style={{ padding: '60px 0', background: 'var(--bg-2)', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Vaka Çalışmaları" title="Gerçek müşteriler, gerçek sayılar." tone="brand" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {cases.map((c, i) => (
            <a key={i} href="#" style={{ background: 'var(--surface)', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 140, background: c.tint, padding: 20, display: 'flex', alignItems: 'flex-end' }}>
                <div className="font-display" style={{ fontSize: 56, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>{c.metric}</div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{c.label} · {c.period}</div>
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>Hikayeyi oku →</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function HelpCenter() {
  const cats = [
    { ico: '🚀', t: 'Başlangıç',       n: 24, d: 'İlk gün, ilk QR, ilk sipariş' },
    { ico: '🍽', t: 'Menü yönetimi',   n: 18, d: 'Ürün, kategori, fiyat' },
    { ico: '🪑', t: 'Masa & QR',        n: 14, d: 'QR oluşturma, yazdırma' },
    { ico: '💳', t: 'Ödemeler',         n: 16, d: 'iyzico, vergi, makbuz' },
    { ico: '👥', t: 'Ekip & izinler',   n: 10, d: 'Üye davet, rol atama' },
    { ico: '📊', t: 'Raporlar',         n: 12, d: 'Analiz, ihracat' },
    { ico: '🔌', t: 'Entegrasyonlar',   n: 22, d: 'Yemeksepeti, Trendyol' },
    { ico: '⚙️', t: 'Hesap',            n: 8,  d: 'Şifre, abonelik, iptal' },
  ]
  return (
    <section id="yardım" style={{ padding: '80px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Yardım Merkezi" title="Aradığınız cevap yakında." sub="124 makale · 7/24 Türkçe destek · ortalama yanıt 4 dakika" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 1080, margin: '0 auto' }}>
          {cats.map(c => (
            <a key={c.t} href="#" style={{ padding: 22, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, textDecoration: 'none', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 28 }}>{c.ico}</div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.t}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{c.d}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 'auto' }}>{c.n} makale →</div>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 28, padding: '18px 22px', background: 'var(--bg-2)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 16, maxWidth: 1080, margin: '28px auto 0' }}>
          <span style={{ fontSize: 24 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Aradığını bulamadın mı?</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>7/24 Türkçe canlı destek — şu an 3 uzman online.</div>
          </div>
          <PrimaryButton size="sm">Sohbet başlat</PrimaryButton>
        </div>
      </div>
    </section>
  )
}

function ApiDocs() {
  return (
    <section id="api" style={{ padding: '60px 0', background: 'var(--night)', color: '#fff', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,208,137,.15)', color: 'var(--accent-2)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>API Dokümanı</span>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.05, margin: '18px 0 0' }}>
              Geliştirici dostu, <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>belgelenmiş</em>.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', marginTop: 16, lineHeight: 1.55 }}>
              REST + Webhooks. Order, payment, menu olaylarına abone ol. Tüm endpoint&apos;ler örnekli, kod parçacıkları kopyalanabilir.
            </p>
            <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
              {([['68', 'endpoint'], ['12', 'webhook olayı'], ['99.98%', 'SLA']] as [string, string][]).map(([v, l]) => (
                <div key={l}>
                  <div className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-2)' }}>{v}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <PrimaryButton dark>Dokümana git <MI.arrow /></PrimaryButton>
              <button style={{ padding: '11px 18px', fontSize: 14, fontWeight: 600, background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.25)', borderRadius: 999, cursor: 'pointer' }}>Postman koleksiyonu</button>
            </div>
          </div>

          <div style={{ background: '#0d0e10', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />)}
              <span style={{ marginLeft: 12, fontFamily: 'Geist Mono', fontSize: 11.5, color: '#7e8089' }}>POST /v1/orders</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent-2)', fontWeight: 700, padding: '2px 7px', background: 'rgba(255,208,137,.12)', borderRadius: 99 }}>200 OK</span>
            </div>
            <pre style={{ margin: 0, padding: 18, fontFamily: 'Geist Mono', fontSize: 12, lineHeight: 1.7, color: '#cdd6f4', overflowX: 'auto' }}>
              <span style={{ color: '#89b4fa' }}>curl</span>{' -X POST \\\n  https://api.garsonless.app/v1/orders \\\n  -H "Authorization: '}<span style={{ color: '#f9e2af' }}>Bearer sk_live_***</span>{'" \\\n  -d \'{\n    '}<span style={{ color: '#94e2d5' }}>&quot;table_id&quot;</span>{': '}<span style={{ color: '#a6e3a1' }}>&quot;t5&quot;</span>{',\n    '}<span style={{ color: '#94e2d5' }}>&quot;items&quot;</span>{': [\n      { '}<span style={{ color: '#94e2d5' }}>&quot;sku&quot;</span>{': '}<span style={{ color: '#a6e3a1' }}>&quot;srm-kah-380&quot;</span>{', '}<span style={{ color: '#94e2d5' }}>&quot;qty&quot;</span>{': '}<span style={{ color: '#fab387' }}>1</span>{' }\n    ]\n  }\''}
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

function Templates() {
  const tpls = [
    { name: 'Menu CSV içe aktarım',  ext: 'CSV',  d: 'Şablon dosyayı doldur, yükle. 200 ürün 30 saniyede.' },
    { name: 'Marka ses rehberi',      ext: 'PDF',  d: 'Tonunuzu menüye taşıyan kelime + emoji kit.' },
    { name: 'QR sticker dosyası',     ext: 'AI',   d: 'Masa stickerları, vitrin etiketi, broşür mockup.' },
    { name: 'KVKK aydınlatma metni', ext: 'DOCX', d: 'Restoran için hazır metin — adınızla doldur.' },
    { name: 'Çalışan oryantasyon',    ext: 'PDF',  d: 'Yeni başlayan ekibe 1 sayfa el rehberi.' },
    { name: 'Stok takip Excel',       ext: 'XLSX', d: 'Hammadde + fire + maliyet takip şablonu.' },
  ]
  return (
    <section id="şablon" style={{ padding: '80px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Şablonlar" title="Hazır dosyalar, indirin kullanın." tone="brand" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 1080, margin: '0 auto' }}>
          {tpls.map(t => (
            <a key={t.name} href="#" style={{ padding: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--ink)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: 'var(--bg-2)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist Mono', fontSize: 11, fontWeight: 700 }}>{t.ext}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{t.d}</div>
                <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 600, marginTop: 8 }}>↓ İndir</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Community() {
  const items = [
    { ico: '💬', t: 'Discord Topluluğu', n: '1 240 üye',    d: 'Günlük operasyon ipuçları, soru-cevap.',          cta: 'Katıl' },
    { ico: '📅', t: 'Aylık Webinar',      n: 'Her ay 1. Salı', d: 'Konuk şefler ve operasyon uzmanları.',          cta: 'Kaydol' },
    { ico: '🎓', t: 'Garson Akademisi',   n: '12 kurs',       d: 'Ücretsiz, sertifikalı eğitim videoları.',        cta: 'Başla' },
  ]
  return (
    <section id="topluluk" style={{ padding: '60px 0', background: 'var(--bg-2)', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Topluluk" title={<>Diğer restoran sahipleriyle <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>tanış</em>.</>} tone="warm" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 1080, margin: '0 auto' }}>
          {items.map(c => (
            <div key={c.t} style={{ padding: 24, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 36 }}>{c.ico}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.t}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{c.n}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55 }}>{c.d}</div>
              </div>
              <button style={{ alignSelf: 'flex-start', padding: '8px 14px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{c.cta} →</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function ResourcesPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <HeroResources />
        <BlogSection />
        <CaseStudies />
        <HelpCenter />
        <ApiDocs />
        <Templates />
        <Community />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}
