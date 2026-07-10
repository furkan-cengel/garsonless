import { MI } from '../../lib/icons'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { SectionHead } from '../../components/ui/SectionHead'
import { PrimaryButton } from '../../components/ui/Buttons'
import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { CTASection } from '../../components/CTASection'

function HeroCompany() {
  return (
    <section style={{ padding: '80px 0 60px', textAlign: 'center', position: 'relative' }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <Eyebrow>Şirket</Eyebrow>
        <h1 className="font-display" style={{ fontSize: 'clamp(44px, 5.5vw, 72px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 0' }}>
          Bizimle <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>tanışın</em>.
        </h1>
        <p style={{ fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.55, margin: '22px auto 0', maxWidth: 580 }}>
          2019&apos;da bir kafe köşesinde çıktığımız yol, bugün Türkiye&apos;nin 28 şehrinde 2 400+ mekana ulaştı.
        </p>
      </div>
    </section>
  )
}

function AboutSection() {
  const timeline: [string, string, string, boolean?][] = [
    ['2019', 'Kuruluş', "Kadıköy'de tek bir kafe ve bir prototip."],
    ['2021', 'İlk 100 mekan', 'COVID döneminde kontaktsız sipariş ihtiyacı bizi büyüttü.'],
    ['2023', 'Pro plan', 'Çoklu şube, API, gelişmiş raporlama.'],
    ['2025', 'Business plan', 'Zincir & franchise için SSO + merkezi yönetim.'],
    ['2026', 'AI çağı', 'Sesli sipariş, otomatik çeviri, akıllı öneriler.', true],
  ]

  const team: [string, string, string, string][] = [
    ['Mehmet Sönmez', 'CEO · Kurucu', '#fce8d3', 'MS'],
    ['Aslı Tan', 'CTO', '#dcf0e1', 'AT'],
    ['Burak Erdoğan', 'CPO', '#f5dcea', 'BE'],
    ['Selin Mumcu', 'Head of Customer', '#cfe8f8', 'SM'],
  ]

  const values: [string, string, string][] = [
    ['🤝', 'Esnaf dostu', 'Her özelliği gerçek bir mekanda test ediyoruz. Geri bildirim 1 hafta içinde panele düşer.'],
    ['🛠', 'Açık inşa', 'Yol haritamız herkese açık. Müşteriler özellik oylar, biz inşa ederiz.'],
    ['🌍', 'Yerel önce', 'Türk gastronomisi için tasarlandık. Türkçe destek, KDV uyumu, KVKK uyumu.'],
  ]

  return (
    <section id="hakkımızda" style={{ padding: '60px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'flex-start' }}>
          <div>
            <Eyebrow tone="warm">Hakkımızda</Eyebrow>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.05, margin: '18px 0 0' }}>
              Bir kafe köşesinde, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>2 garsonsuz akşam</em>.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.65 }}>
              2019 baharında Kadıköy&apos;de bir kafe açtık. Açılışın 2. günü iki garson işten ayrıldı. O akşam müşterilerin telefonlarından sipariş alabilseydik diye düşündük — ve masabu doğdu.
            </p>
            <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.65 }}>
              Bugün İstanbul, Ankara, İzmir, Antalya ve daha 24 şehirdeki kafeler, restoranlar, otel restoranları bizimle çalışıyor.
            </p>
            <div style={{ display: 'flex', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
              {([['2 400+', 'aktif mekan'], ['28', 'şehir'], ['18M+', 'aylık sipariş'], ['%99.98', 'uptime']] as [string, string][]).map(([v, l]) => (
                <div key={l}>
                  <div className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--brand)' }}>{v}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)', padding: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 24 }}>Yolculuk</div>
            {timeline.map(([y, t, d, current], i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i === arr.length - 1 ? 0 : 22 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: current ? 'var(--accent)' : 'var(--ink)', display: 'block', marginTop: 4, boxShadow: current ? '0 0 0 4px rgba(217,119,87,.2)' : 'none' }} />
                  {i < arr.length - 1 && <span style={{ position: 'absolute', left: 5, top: 18, bottom: -22, width: 2, background: 'var(--line)' }} />}
                </div>
                <div>
                  <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: current ? 'var(--accent)' : 'var(--ink-2)' }}>
                    {y}{current && <span style={{ marginLeft: 8, padding: '1px 6px', background: 'var(--accent)', color: '#fff', fontSize: 9, borderRadius: 99 }}>BUGÜN</span>}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{t}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 80 }}>
          <SectionHead title="Ekip" sub="14 kişi · İstanbul ve Berlin · 80% uzaktan" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
            {team.map(([n, r, c, initials]) => (
              <div key={n} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: 999, background: c, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{initials}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 80, padding: 40, background: 'var(--bg-2)', borderRadius: 24 }}>
          <SectionHead title="Değerlerimiz" tone="warm" maxW={560} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1040, margin: '0 auto' }}>
            {values.map(([e, t, d]) => (
              <div key={t}>
                <div style={{ fontSize: 28 }}>{e}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>{t}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.55 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CareersSection() {
  const jobs = [
    { t: 'Senior Frontend Engineer', team: 'Mühendislik', loc: 'İstanbul / Uzaktan', type: 'Tam zamanlı' },
    { t: 'Product Designer', team: 'Tasarım', loc: 'İstanbul', type: 'Tam zamanlı' },
    { t: 'Customer Success Lead', team: 'CX', loc: 'İstanbul', type: 'Tam zamanlı' },
    { t: 'Backend Engineer (Node)', team: 'Mühendislik', loc: 'Berlin / Uzaktan', type: 'Tam zamanlı' },
    { t: 'Restoran Onboarding Uzmanı', team: 'CX', loc: 'İstanbul', type: 'Tam zamanlı' },
    { t: 'Pazarlama Stajyeri', team: 'Pazarlama', loc: 'İstanbul', type: 'Staj · 6 ay' },
  ]

  return (
    <section id="kariyer" style={{ padding: '80px 0', background: 'var(--night)', color: '#fff', scrollMarginTop: 80 }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,208,137,.15)', color: 'var(--accent-2)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Kariyer · 6 açık pozisyon</span>
            <h2 className="font-display" style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.05, margin: '18px 0 0' }}>
              Bizimle <em style={{ fontStyle: 'italic', color: 'var(--accent-2)' }}>inşa edin</em>.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', marginTop: 14, maxWidth: 540 }}>
              80% uzaktan · esnek saatler · sınırsız izin · birinci sınıf ekipman · gerçek bir misyon.
            </p>
          </div>
          <a href="#" style={{ textDecoration: 'none' }}>
            <button style={{ padding: '12px 20px', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.15)', borderRadius: 999, cursor: 'pointer' }}>Genel başvuru →</button>
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map(j => (
            <a key={j.t} href="#" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, textDecoration: 'none', color: '#fff' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{j.t}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 4, display: 'flex', gap: 14 }}>
                  <span>· {j.team}</span><span>📍 {j.loc}</span><span>⏱ {j.type}</span>
                </div>
              </div>
              <span style={{ color: 'var(--accent-2)' }}><MI.arrow size={16} /></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function PressSection() {
  const press = [
    { src: 'TechCrunch', date: 'Mar 2026', t: "Masabu lands $4M Series A for Turkey's F&B digitization" },
    { src: 'Webrazzi', date: 'Şub 2026', t: 'Masabu 2 400 mekana ulaştı, B2B abone modelinde rekor' },
    { src: 'Hürriyet', date: 'Oca 2026', t: "Restoran teknolojisinde Türk girişim Avrupa'ya açıldı" },
    { src: 'Forbes Türkiye', date: 'Ara 2025', t: '40 yaş altı 40 girişimci: Mehmet Sönmez listede' },
  ]

  return (
    <section id="basın" style={{ padding: '80px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Basın & Medya" title="Hakkımızda yazılanlar." tone="brand" />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32, maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {press.map((p, i) => (
              <a key={i} href="#" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, textDecoration: 'none', color: 'var(--ink)' }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: 'var(--bg-2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: 'var(--ink-3)' }}>{p.src[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.05em' }}>{p.src} · {p.date}</div>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{p.t}</div>
                </div>
                <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}><MI.arrow size={16} /></span>
              </a>
            ))}
          </div>

          <div style={{ background: 'var(--bg-2)', borderRadius: 18, padding: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Basın kiti</div>
            <h3 className="font-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em', margin: '8px 0 0' }}>İndirilebilir kaynaklar</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              {([['Logo paketi (SVG, PNG)', '4.2 MB'], ['Marka rehberi (PDF)', '8.1 MB'], ['Ekran görüntüleri', '12 MB'], ['Şirket bilgisi (PDF)', '320 KB']] as [string, string][]).map(([n, s]) => (
                <a key={n} href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, textDecoration: 'none', color: 'var(--ink)' }}>
                  <span style={{ fontFamily: 'Geist Mono', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', padding: '2px 6px', background: 'var(--bg-2)', borderRadius: 3 }}>↓</span>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{n}</div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s}</span>
                </a>
              ))}
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
              Basın iletişim:<br />
              <a href="mailto:press@masabu.co" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>press@masabu.co</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  return (
    <section id="iletişim" style={{ padding: '80px 0', background: 'var(--bg-2)', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="İletişim" title="Konuşalım." tone="warm" maxW={560} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)', padding: 32 }}>
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>Bize yazın</h3>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6 }}>Ortalama yanıt süresi 4 saat.</p>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([['Ad Soyad', 'Ayşe Yılmaz'], ['E-posta', 'ayse@acimarka.co'], ['Mekan adı', 'Acımarka Kafe']] as [string, string][]).map(([l, p]) => (
                <label key={l} style={{ display: 'block' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{l}</div>
                  <input placeholder={p} style={{ width: '100%', height: 42, padding: '0 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 14, outline: 'none' }} />
                </label>
              ))}
              <label>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Konu</div>
                <select style={{ width: '100%', height: 42, padding: '0 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 14, background: '#fff', outline: 'none' }}>
                  <option>Satış görüşmesi planlama</option>
                  <option>Demo talebi</option>
                  <option>Teknik destek</option>
                  <option>Basın & medya</option>
                  <option>Ortaklık</option>
                </select>
              </label>
              <label>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Mesajınız</div>
                <textarea rows={4} placeholder="Bize neden ulaşıyorsunuz?" style={{ width: '100%', padding: 14, border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
              </label>
              <PrimaryButton style={{ marginTop: 6 }}>Gönder <MI.arrow /></PrimaryButton>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { ico: '💬', t: 'Canlı destek', d: '7/24 Türkçe · ortalama 4 dk yanıt', cta: 'Sohbet başlat' },
              { ico: '📞', t: 'Satış', d: 'Çoklu mağaza, özel teklif', cta: '+90 850 *** ** **' },
              { ico: '✉', t: 'E-posta', d: 'Hızlı sorular', cta: 'merhaba@masabu.co' },
            ].map(c => (
              <div key={c.t} style={{ padding: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: 26 }}>{c.ico}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{c.t}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{c.d}</div>
                </div>
                <a href="#" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>{c.cta}</a>
              </div>
            ))}
            <div style={{ marginTop: 6, padding: 20, background: 'var(--ink)', color: '#fff', borderRadius: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-2)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Ofisler</div>
              <div style={{ marginTop: 14, display: 'flex', gap: 28 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🇹🇷 İstanbul</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 4, lineHeight: 1.5 }}>Bağdat Cd. No: 128/A<br />Kadıköy, 34710</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🇩🇪 Berlin</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 4, lineHeight: 1.5 }}>Kurfürstendamm 12<br />10719 Berlin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PartnersSection() {
  const benefits = [
    { ico: '📈', t: 'Cömert komisyon', d: 'İlk yıl %20, sonraki yıllar %15. Aylık yenilemeden gelir devam eder.' },
    { ico: '🎯', t: 'Pazar bölgesi', d: 'Şehrinizde özel bayilik. Diğer satıcılar müdahale edemez.' },
    { ico: '🚀', t: 'Pazarlama destek', d: 'Marka materyalleri, lokal etkinlik desteği, dijital kampanyalar.' },
  ]

  return (
    <section id="bayilik" style={{ padding: '80px 0', scrollMarginTop: 80 }}>
      <div className="container">
        <SectionHead eyebrow="Bayilik Programı" title="Bizimle ortak olun." sub="Şehrinizde masabu temsilcisi olun · %20 komisyon · pazarlama desteği · özel eğitim" tone="brand" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 1080, margin: '0 auto 32px' }}>
          {benefits.map(b => (
            <div key={b.t} style={{ padding: 24, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }}>
              <div style={{ fontSize: 28 }}>{b.ico}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{b.t}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.55 }}>{b.d}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <a href="#iletişim" style={{ textDecoration: 'none' }}>
            <PrimaryButton size="lg">Bayilik başvurusu yap <MI.arrow /></PrimaryButton>
          </a>
        </div>
      </div>
    </section>
  )
}

export default function CompanyPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <HeroCompany />
        <AboutSection />
        <CareersSection />
        <PressSection />
        <ContactSection />
        <PartnersSection />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}
