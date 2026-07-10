import { MI } from '../../lib/icons'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { SectionHead } from '../../components/ui/SectionHead'
import { PrimaryButton } from '../../components/ui/Buttons'
import { GhostButton } from '../../components/ui/Buttons'
import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { CTASection } from '../../components/CTASection'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

interface Solution {
  id: string
  eyebrow: string
  title: string
  desc: string
  metric: string
  metricLabel: string
  color: string
  accent: string
  icon: string
  features: [string, string][]
  quote: { t: string; n: string; r: string }
}

const SOLUTIONS: Solution[] = [
  {
    id: 'kafeler',
    eyebrow: 'Kafeler',
    title: "Kahvenizin tadına bakın — kuyruğa bakmayın.",
    desc: "Saat 8'in koşturmacasında bile her sipariş doğru masaya, doğru sırayla düşer.",
    metric: '−38%', metricLabel: 'sipariş süresi',
    color: '#fce8d3', accent: '#a13b7a', icon: '☕',
    features: [
      ['QR menü dakikalar içinde', 'Görsel, alerjen, çoklu dil dahil. Kahvaltı yoğunluğunda mucize.'],
      ['Yapı kahvaltı düzeni', 'Serpme, tabak, kişi sayısı — varyantlar ekstra ücretsiz.'],
      ['Bar yazıcısı + Mutfak', 'Espresso bar ile mutfak ayrı ayrı yazar. Karışıklık biter.'],
      ['Tabletten süper hızlı', 'Hafta sonu 30 masa — barista konsantre, müşteri rahat.'],
    ],
    quote: { t: 'Brunch saatinde 4 kişiyle döndürüyorduk, şimdi 2. Müşteriler kuyrukta beklemiyor.', n: 'Defne Aksoy', r: 'MAF Cafe Lounge' },
  },
  {
    id: 'restoranlar',
    eyebrow: 'Restoranlar',
    title: 'Servis konsantre, ödeme kibar.',
    desc: 'Müşteri hesabı isteyene kadar saatler geçmesin. Servis ekibi mutfağa odaklansın.',
    metric: '4.8★', metricLabel: 'ortalama puan',
    color: '#dcf0e1', accent: '#137a4d', icon: '🍽',
    features: [
      ['Mutfak ekranı (KDS)', 'Sıcak/soğuk istasyonlara ayrı kuyruk. Gecikme alarmı sarı.'],
      ['Bölüştürülmüş hesap', 'Müşteri masada hesabı kişi başı böler — garson çağırmadan.'],
      ['Bahşiş seçici', '%5/%10/%15 + özel. Servis ekibine doğrudan akar.'],
      ['Sezon menü revizyonu', 'Mevsim ürünleri tek panelden anlık güncel.'],
    ],
    quote: { t: 'Sezonsal menü değişikliklerimizi 2 saatten 10 dakikaya indirdik.', n: 'Cengiz Soy', r: 'Mezzogiorno' },
  },
  {
    id: 'bar',
    eyebrow: 'Bar & Meyhane',
    title: "Akşamın akışı bozulmasın.",
    desc: "Müşteri masada kalırken kokteyl listenizi keşfetsin, sürekli sipariş versin, ödeme bekleyip durmasın.",
    metric: '+%52', metricLabel: 'masa devri',
    color: '#f5dcea', accent: '#7a3aa3', icon: '🍷',
    features: [
      ['Şarap & kokteyl menüsü', 'Tat profili, alkol oranı, eşleştirme önerisi — şıkça.'],
      ['Yaş onayı (18+)', "QR'ı tarayan misafir önce yaş onayı verir."],
      ['Müzik isteği', 'Spotify aktif çalma listesine talep yollar (opsiyonel).'],
      ['Gece modu tema', 'Loş ışıkta okunaklı, müşteri telefonunu otomatik kısar.'],
    ],
    quote: { t: 'Akşam servisinde 3 garsonla 40 masa çevirebiliyoruz — eskiden 6 idi.', n: 'Selin Mert', r: 'Boğaz Meyhanesi' },
  },
  {
    id: 'zincir',
    eyebrow: 'Zincir & Franchise',
    title: 'Bir merkez, on şube, sıfır karmaşa.',
    desc: 'Menüyü merkezden yönet, lokal fiyat ayarlamalarına izin ver, raporları konsolide gör.',
    metric: '12', metricLabel: 'şube tek panelden',
    color: '#cfe8f8', accent: '#1f4e8f', icon: '🏢',
    features: [
      ['Merkezi menü yönetimi', 'Tek değişiklik tüm şubelere anlık yayımlanır.'],
      ['Şube bazlı fiyat & stok', 'Lokasyon farkları yerel kontrolde, marka tek.'],
      ['Konsolide raporlama', 'Hangi şube parlıyor, hangisi dikkat istiyor — bir tabloda.'],
      ['SSO + Rol matrisi', 'Bölge müdürü, şube müdürü, çalışan — yetkiler ayrı.'],
    ],
    quote: { t: '12 şubemizde menü güncellemeyi 1 günden 5 dakikaya indirdik.', n: 'Aslı Kara', r: 'Kahveci Mustafa Amca' },
  },
  {
    id: 'otel',
    eyebrow: 'Otel Restoranları',
    title: "Lobiden odaya, kahvaltıdan room service'e.",
    desc: "Otel misafirleriniz oda numarasıyla sipariş versin, faturalama PMS'inize otomatik düşsün.",
    metric: '24/7', metricLabel: 'oda servisi',
    color: '#fbeee2', accent: '#8a4a1c', icon: '🏨',
    features: [
      ['PMS entegrasyonu', 'Opera, Protel, Mews — oda hesabına otomatik ekle.'],
      ['Oda numarası ile sipariş', "Misafir QR'ı tarar, oda no yazar — sipariş cebine düşer."],
      ['Çok dilli menü (8+ dil)', 'Otomatik AI çeviri ile tüm misafirler kendi dilinde.'],
      ['Restoran + bar + spa', 'Tüm otel F&B noktaları tek hesapta.'],
    ],
    quote: { t: "Misafirlerin Türkçe bilmeden sipariş verebilmesi bizim için oyun değiştirici oldu.", n: 'Murat Demir', r: 'Sevena Hotel' },
  },
]

function HeroSolutions() {
  return (
    <section style={{ padding: '80px 0 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -200, right: -100, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,.15), transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -120, left: -120, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(161,59,122,.12), transparent 65%)', pointerEvents: 'none' }} />
      <div className="container" style={{ position: 'relative', maxWidth: 880 }}>
        <Eyebrow>Çözümler</Eyebrow>
        <h1 className="font-display" style={{ fontSize: 'clamp(44px, 5.5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 0' }}>
          Her mekanın bir <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>ritmi</em> var.<br />
          Bizim de cevabı.
        </h1>
        <p style={{ fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.55, margin: '24px auto 0', maxWidth: 580 }}>
          Kafe, fine-dining, bar, zincir veya otel — masabu her venue&apos;ya kendi şeklini alır.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 32 }}>
          {SOLUTIONS.map(s => (
            <a key={s.id} href={'#' + s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: s.color, color: s.accent, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
              <span>{s.icon}</span>{s.eyebrow}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function SolutionSection({ sol, flip }: { sol: Solution; flip: boolean }) {
  const initials = sol.quote.n.split(' ').map(p => p[0]).join('')
  return (
    <section id={sol.id} style={{ padding: '60px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          <div style={{ order: flip ? 2 : 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: sol.color, color: sol.accent, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              <span>{sol.icon}</span> {sol.eyebrow}
            </div>
            <h2 className="font-display" style={{ fontSize: 'clamp(30px, 3.5vw, 44px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '18px 0 0' }}>{sol.title}</h2>
            <p style={{ fontSize: 16.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '16px 0 0' }}>{sol.desc}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sol.features.map(([t, d], i) => (
                <li key={i} style={{ display: 'flex', gap: 14 }}>
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, background: sol.color, color: sol.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MI.check size={13} />
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{t}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>{d}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 10, marginTop: 32, flexWrap: 'wrap' }}>
              <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none' }}>
                <PrimaryButton>14 gün ücretsiz dene <MI.arrow /></PrimaryButton>
              </a>
              <a href="/company#iletişim" style={{ textDecoration: 'none' }}>
                <GhostButton>Demo planla</GhostButton>
              </a>
            </div>
          </div>

          <div style={{ order: flip ? 1 : 2, position: 'relative' }}>
            <div style={{ background: sol.color, borderRadius: 24, padding: 32, position: 'relative', overflow: 'hidden', minHeight: 480, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: -20, right: -10, fontSize: 220, opacity: .25, transform: 'rotate(-12deg)', userSelect: 'none', lineHeight: 1 }}>{sol.icon}</div>
              <div style={{ background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 10px 30px -10px rgba(0,0,0,.12)', marginBottom: 'auto', maxWidth: 220, position: 'relative' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Sonuç</div>
                <div className="font-display" style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.03em', color: sol.accent, lineHeight: 1, marginTop: 4 }}>{sol.metric}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{sol.metricLabel}</div>
              </div>
              <div style={{ marginTop: 24, background: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 10px 30px -10px rgba(0,0,0,.12)', position: 'relative' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} style={{ color: '#f0b429', fontSize: 13 }}>★</span>
                  ))}
                </div>
                <blockquote className="font-display" style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.4, margin: 0, color: 'var(--ink)' }}>&ldquo;{sol.quote.t}&rdquo;</blockquote>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: sol.accent, color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{sol.quote.n}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sol.quote.r}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ComparisonTable() {
  const rows: [string, boolean, boolean, boolean, boolean, boolean][] = [
    ['QR menü', true, true, true, true, true],
    ['Mutfak ekranı', true, true, true, true, true],
    ['Bölüştürülmüş hesap', false, true, true, true, true],
    ['Bahşiş seçici', false, true, true, false, true],
    ['Yaş onayı (18+)', false, false, true, false, false],
    ['Müzik isteği', false, false, true, false, false],
    ['PMS entegrasyonu', false, false, false, false, true],
    ['Çoklu şube', false, false, false, true, true],
    ['SSO + rol matrisi', false, false, false, true, true],
    ['AI çeviri (8+ dil)', false, true, false, false, true],
  ]

  return (
    <section style={{ padding: '80px 0', background: 'var(--bg-2)' }}>
      <div className="container">
        <SectionHead
          title={<>Mekanına göre <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>özellikler</em>.</>}
          sub="Her venue tipinin kendi öne çıkanları var — hepsi her plan paketinde aynı şekilde gelmez."
        />
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(5, 1fr)', background: 'var(--night)', color: '#fff' }}>
            <div style={{ padding: '16px 20px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Özellik</div>
            {SOLUTIONS.map(s => (
              <div key={s.id} style={{ padding: '14px 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.eyebrow}</div>
              </div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(5, 1fr)', borderTop: '1px solid var(--line)', background: i % 2 ? 'var(--bg-2)' : 'transparent' }}>
              <div style={{ padding: '14px 20px', fontSize: 14, fontWeight: 500 }}>{r[0]}</div>
              {(r.slice(1) as boolean[]).map((v, j) => (
                <div key={j} style={{ padding: '14px 0', textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
                  {v
                    ? <span style={{ color: 'var(--positive)' }}><MI.check size={18} /></span>
                    : <span style={{ color: 'var(--ink-4)' }}><MI.x size={15} /></span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function SolutionsPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <HeroSolutions />
        {SOLUTIONS.map((s, i) => <SolutionSection key={s.id} sol={s} flip={i % 2 === 1} />)}
        <ComparisonTable />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}
