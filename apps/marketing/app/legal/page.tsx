'use client'

import { useState, useEffect } from 'react'
import { Eyebrow } from '../../components/ui/Eyebrow'
import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'

interface LegalSection {
  t: string
  items: string[]
}

interface LegalDoc {
  label: string
  icon: string
  updated: string
  version: string
  summary: string
  sections: LegalSection[]
}

const DOCS: Record<string, LegalDoc> = {
  gizlilik: {
    label: 'Gizlilik Politikası', icon: '🛡',
    updated: '12 Mayıs 2026', version: 'v3.2',
    summary: 'Hangi verileri topluyoruz, neden topluyoruz ve siz bu konuda hangi haklara sahipsiniz.',
    sections: [
      { t: 'Topladığımız bilgiler', items: [
        'Hesap bilgileri: ad, e-posta, telefon, şifre (hashlenmiş)',
        'Mağaza bilgileri: işletme adı, adres, vergi bilgileri',
        'Sipariş verileri: ürün, fiyat, zaman damgası, masa',
        'Kullanım verileri: hangi panelleri ne sıklıkla kullanıyorsunuz',
        'Cihaz bilgileri: tarayıcı, IP, işletim sistemi (anonimleştirilmiş)',
      ]},
      { t: 'Verileri nasıl kullanıyoruz', items: [
        'Hizmeti sağlamak ve geliştirmek',
        'Hesap güvenliği için doğrulama ve şüpheli aktivite tespiti',
        'Faturalama ve ödeme işlemleri',
        'Önemli güncellemeler için iletişim (pazarlama için ayrı onay)',
        'Yasal yükümlülükleri yerine getirmek (vergi, denetim)',
      ]},
      { t: 'Üçüncü taraflarla paylaşım', items: [
        'iyzico (ödeme işlemleri)',
        'Resend (e-posta dağıtımı)',
        'Sentry (hata izleme — anonim)',
        'PostHog (kullanım analitiği — IP anonim)',
        'Bu listenin dışındaki hiçbir tarafa veri satılmaz veya kiralanmaz.',
      ]},
      { t: 'Veri saklama süreleri', items: [
        'Aktif hesap verileri: hesap aktif olduğu sürece',
        'Sipariş kayıtları: 10 yıl (vergi mevzuatı)',
        "Ödeme bilgileri: iyzico'da PCI-DSS uyumlu olarak saklanır",
        'İptal sonrası: 60 gün geri yükleme penceresi, ardından anonimleştirme',
      ]},
      { t: 'Sizin haklarınız', items: [
        'Veri erişimi: tüm verilerinizi dışa aktarabilirsiniz (Ayarlar > Veri)',
        'Düzeltme: yanlış verileri panelden güncelleyebilirsiniz',
        'Silme: hesabı tek tıkla iptal edebilirsiniz',
        'Taşınabilirlik: CSV, JSON formatlarında export',
        'İtiraz: privacy@masabu.co',
      ]},
    ],
  },
  şartlar: {
    label: 'Kullanım Şartları', icon: '📜',
    updated: '8 Mayıs 2026', version: 'v4.1',
    summary: "masabu'i kullanırken sizin ve bizim sorumluluklarımız.",
    sections: [
      { t: 'Hizmetin kapsamı', items: [
        'masabu bir SaaS platformudur — QR menü, sipariş yönetimi, raporlama',
        "Müşterilerin telefonlarından sipariş vermesini sağlar",
        'Hizmet aralıksız çalışır — %99.9 SLA Pro+ planlarda garanti edilir',
      ]},
      { t: 'Abonelik & ödeme', items: [
        '14 gün ücretsiz deneme — kart bilgisi gerekmez',
        'Yıllık veya aylık ödeme — yıllık %20 indirim',
        'Gösterilen plan fiyatları KDV dâhildir',
        'Yıllık ücret peşin tahsil edilir; dönem ortasında pro-rata uygulanmaz',
        'İptal sonrası veriler geçerli saklama politikası boyunca korunur',
      ]},
      { t: 'Kabul edilebilir kullanım', items: [
        'Yasal olarak işlettiğiniz mekanlar için kullanın',
        'Spam, dolandırıcılık, yanıltıcı menü içeriği yasaktır',
        'Telif hakkı ihlali içeren görseller yüklemeyin',
        'Otomatik isteklerle hizmetin güvenlik sınırlarını aşmayın',
        '3. taraflara hesabınızı satmayın',
      ]},
      { t: 'Sorumluluk reddi', items: [
        'Üçüncü taraf entegrasyonlardaki kesintiler için sorumlu değiliz',
        'İşletme verilerinizi yedeklemek için (export özelliği vardır) sorumluluk size aittir',
        'Maddi zarar tazminat tavanı: son 12 aylık abonelik ücreti',
      ]},
      { t: 'Değişiklikler', items: [
        'Şartları değiştirmeden 30 gün önce e-posta ile haber veririz',
        'Önemli değişiklikler için panele bildirim düşer',
        'Kabul etmezseniz son güne kadar iptal edebilirsiniz',
      ]},
    ],
  },
  kvkk: {
    label: 'KVKK Aydınlatma', icon: '🇹🇷',
    updated: '12 Mayıs 2026', version: 'v2.1',
    summary: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu olarak aydınlatma metnimiz.',
    sections: [
      { t: 'Veri sorumlusu', items: [
        'Unvan: Masabu Teknoloji A.Ş.',
        'Adres: Bağdat Cd. No: 128/A, Kadıköy / İstanbul',
        'MERSIS: 0123 4567 8910 1112',
        'VERBIS sicil no: VRB-2021-001234',
      ]},
      { t: 'İşlenen veri kategorileri', items: [
        'Kimlik bilgileri (ad, soyad)',
        'İletişim bilgileri (e-posta, telefon, adres)',
        'Müşteri işlem bilgileri (sipariş, ödeme)',
        'İşlem güvenliği bilgileri (IP, log)',
        'Pazarlama bilgileri (çerez, kullanım davranışı)',
      ]},
      { t: 'İşleme amaçları', items: [
        'Hizmet sözleşmesinin kurulması ve ifası',
        'Yasal yükümlülüklerin yerine getirilmesi',
        'Hizmet kalitesinin artırılması',
        'Müşteri memnuniyetinin sağlanması',
        'Pazarlama (açık rıza gerektirir)',
      ]},
      { t: 'Yurt dışına aktarım', items: [
        "Verileriniz Türkiye sınırları içinde barındırılır",
        'Bazı hizmetler (Sentry, PostHog) AB sunucularını kullanır — Standart Sözleşme Maddeleri uygulanır',
        'Yurtdışı aktarımına açık rıza istenir',
      ]},
      { t: 'İlgili kişinin hakları (Madde 11)', items: [
        'Verilerinizin işlenip işlenmediğini öğrenme',
        'İşlenmişse buna ilişkin bilgi talep etme',
        'İşleme amacına uygun kullanılıp kullanılmadığını öğrenme',
        'Eksik veya yanlış işlenmişse düzeltilmesini isteme',
        'Silinmesini veya yok edilmesini isteme',
        'Aktarıldığı 3. taraflara bildirilmesini isteme',
        'Otomatik sistemlerle yapılan analizler sonucu çıkan bir karara itiraz',
        'Zarar uğradıysanız tazminat talep etme',
      ]},
      { t: 'Başvuru yolları', items: [
        'E-posta: kvkk@masabu.co (kayıtlı e-postanızdan)',
        'Posta: Bağdat Cd. No: 128/A, Kadıköy / İstanbul (KVKK İlgili Kişi Başvurusu)',
        'Yanıt süresi: en geç 30 gün',
        'Başvuru formu: Yardım merkezinde indirilebilir',
      ]},
    ],
  },
  çerezler: {
    label: 'Çerez Politikası', icon: '🍪',
    updated: '5 Mayıs 2026', version: 'v2.0',
    summary: 'Web sitemizde ve uygulamamızda kullandığımız çerezler, neden gerekli ve nasıl yönetilir.',
    sections: [
      { t: 'Çerez nedir?', items: [
        'Çerezler, ziyaret ettiğiniz sitelerin tarayıcınıza yerleştirdiği küçük metin dosyalarıdır',
        'Oturumunuzu korumak, tercihlerinizi hatırlamak, kullanım istatistikleri için kullanılır',
      ]},
      { t: 'Zorunlu çerezler (her zaman aktif)', items: [
        'Oturum açma durumunu tutar',
        'CSRF saldırılarına karşı koruma sağlar',
        'Dil tercihi (TR/EN) kaydedilir',
        'Sepet içeriği (geçici olarak) saklanır',
      ]},
      { t: 'Analitik çerezler (opsiyonel)', items: [
        'PostHog: hangi panelleri kullanıyorsunuz — ürünü iyileştirmek için',
        'IP anonimleştirilir, kişiyi tanımlayan veri tutulmaz',
        'Reddederseniz hizmet etkilenmez',
      ]},
      { t: 'Pazarlama çerezleri (opsiyonel)', items: [
        'Yalnızca açık rıza ile aktifleşir',
        'Google Ads, Meta Pixel — yeniden hedefleme için',
        'Çerez tercih merkezinden istediğiniz zaman kapatabilirsiniz',
      ]},
      { t: 'Çerezleri nasıl yönetirim?', items: [
        'Tarayıcı ayarlarınızdan tüm çerezleri silebilirsiniz',
        'Sitemizin altındaki "Çerez Tercihleri" butonundan ayar yapabilirsiniz',
        'İlk ziyaretinizde size sorulan onayı istediğiniz zaman değiştirebilirsiniz',
      ]},
    ],
  },
}

type DocKey = keyof typeof DOCS

function HeroLegal() {
  return (
    <section style={{ padding: '70px 0 40px', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <Eyebrow tone="cream">Yasal</Eyebrow>
        <h1 className="font-display" style={{ fontSize: 'clamp(38px, 5vw, 60px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '20px 0 0' }}>
          Şeffaf, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>okunabilir</em>, dürüst.
        </h1>
        <p style={{ fontSize: 16.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: '18px auto 0', maxWidth: 540 }}>
          Hangi verileri topladığımız, neden topladığımız ve sizin hangi haklarınız olduğu — sade Türkçe ile.
        </p>
      </div>
    </section>
  )
}

function LegalBody() {
  const [active, setActive] = useState<DocKey>('gizlilik')

  useEffect(() => {
    const hash = window.location.hash.slice(1) as DocKey
    if (DOCS[hash]) setActive(hash)

    const onHash = () => {
      const h = window.location.hash.slice(1) as DocKey
      if (DOCS[h]) setActive(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const setActiveDoc = (k: DocKey) => {
    setActive(k)
    history.replaceState(null, '', '#' + k)
  }

  const doc = DOCS[active]!

  const contactNote = active === 'kvkk'
    ? 'KVKK ile ilgili her şey için kvkk@masabu.co'
    : active === 'gizlilik'
      ? 'Gizlilikle ilgili sorularınız için privacy@masabu.co'
      : 'merhaba@masabu.co — 4 saat içinde dönüş'

  return (
    <section style={{ padding: '20px 0 80px' }}>
      <div className="container" style={{ maxWidth: 1040 }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-2)', borderRadius: 99, border: '1px solid var(--line)', overflowX: 'auto', marginBottom: 36, maxWidth: 'fit-content', margin: '0 auto 36px' }}>
          {(Object.entries(DOCS) as [DocKey, LegalDoc][]).map(([k, d]) => (
            <button key={k} onClick={() => setActiveDoc(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 99, background: active === k ? 'var(--ink)' : 'transparent', color: active === k ? '#fff' : 'var(--ink-2)', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, transition: 'all 120ms', whiteSpace: 'nowrap' }}>
              <span>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40 }}>
          <aside style={{ position: 'sticky', top: 90, alignSelf: 'flex-start' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>Bu sayfada</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {doc.sections.map((s, i) => (
                <a key={i} href={`#sec-${i}`} style={{ padding: '7px 10px', paddingLeft: 12, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', borderRadius: 6, borderLeft: '2px solid var(--line)' }}>{s.t}</a>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: 14, background: 'var(--bg-2)', borderRadius: 10, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Yasal kaynak doğrudan içe açıktır. Anlam farkı olursa Türkçe metin geçerlidir.
              <a href="#" style={{ display: 'block', marginTop: 8, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>PDF olarak indir →</a>
            </div>
          </aside>

          <article>
            <div style={{ padding: 24, background: 'var(--bg-2)', borderRadius: 14, marginBottom: 36, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 36 }}>{doc.icon}</div>
              <div style={{ flex: 1 }}>
                <h2 className="font-display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>{doc.label}</h2>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                  <span>Son güncelleme: <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{doc.updated}</strong></span>
                  <span>·</span>
                  <span>Sürüm <strong style={{ fontFamily: 'Geist Mono', color: 'var(--ink-2)' }}>{doc.version}</strong></span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.65, fontStyle: 'italic', padding: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: '4px solid var(--brand)', borderRadius: 10, margin: '0 0 40px' }}>{doc.summary}</p>

            {doc.sections.map((sec, i) => (
              <div key={i} id={`sec-${i}`} style={{ marginBottom: 36, scrollMarginTop: 100 }}>
                <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'Geist Mono', fontSize: 13, color: 'var(--ink-4)', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
                  {sec.t}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sec.items.map((it, j) => (
                    <li key={j} style={{ display: 'flex', gap: 12 }}>
                      <span style={{ flexShrink: 0, marginTop: 8, width: 6, height: 6, borderRadius: 999, background: 'var(--brand)' }} />
                      <span style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.65 }}>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div style={{ marginTop: 60, padding: 24, background: 'var(--night)', color: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontSize: 26 }}>📩</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Sorularınız mı var?</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{contactNote}</div>
              </div>
              <a href="/company#iletişim" style={{ textDecoration: 'none' }}>
                <button style={{ padding: '10px 16px', background: 'var(--accent-2)', color: 'var(--ink)', border: 'none', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>İletişime geç →</button>
              </a>
            </div>

            <div style={{ marginTop: 28, padding: '14px 18px', border: '1px dashed var(--line)', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>📚</span>
              Eski sürümler GitHub&apos;da arşivlenmiştir. Değişiklik geçmişi <a href="#" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>açık şekilde</a> tutulur.
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default function LegalPage() {
  return (
    <>
      <MarketingNav />
      <main>
        <HeroLegal />
        <LegalBody />
      </main>
      <MarketingFooter />
    </>
  )
}
