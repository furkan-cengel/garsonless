import Link from 'next/link'
import Image from 'next/image'
import { MarketingPage } from './MarketingPage'
import { TrialSection } from './TrialSection'
import { FAQAccordion } from './FAQAccordion'
import { serializeJsonLd, SITE_ORIGIN } from '../lib/seo'
import {
  ALLERGENS,
  COMPLIANCE_ROWS,
  DECLARATION_METHODS,
  MAIN_DEADLINE_ISO,
  REGULATION_FAQS,
  REGULATION_SOURCE,
  COMPLIANCE_SOURCE,
  daysUntilDeadline,
  hasDeadlinePassed,
} from '../lib/menu-regulation'
import styles from './MenuRegulationPage.module.css'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const PRODUCT_STEPS = [
  {
    title: 'Menüyü bir kez tanımlayın',
    body: 'Ürünlerinizi kategorileriyle girin veya hazır CSV şablonuyla toplu aktarın. Her ürünün altında bileşen listesi, porsiyon kalorisi ve alerjen alanları bulunur.',
  },
  {
    title: 'Eksik bilgiyi gözden kaçırmayın',
    body: 'Bileşen veya alerjen bilgisi tamamlanmamış ürünler panelde açıkça “Bilgi eksik” olarak işaretlenir. Hangi üründe ne eksik olduğunu tek ekrandan görürsünüz.',
  },
  {
    title: 'Çapraz bulaşmayı ayrı belirtin',
    body: 'Ürünün içinde bulunmayan ama aynı mutfakta bulaşma ihtimali olan alerjenler ayrı bir alanda tutulur ve misafire ayrı başlıkla gösterilir.',
  },
  {
    title: 'Karekodu masaya asın',
    body: 'QR Studio ile masa karekodlarınızı hazırlayıp yazdırın. Menüde bir fiyat veya içerik değiştiğinde karekod aynı kalır; baskı yenilemeniz gerekmez.',
  },
]

export function MenuRegulationPage() {
  const today = new Date()
  const daysLeft = daysUntilDeadline(today)
  const mainDeadlinePassed = hasDeadlinePassed(today, MAIN_DEADLINE_ISO)
  const canonical = '/menu-alerjen-zorunlulugu'

  const faqGraph = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: REGULATION_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }

  return (
    <MarketingPage breadcrumbs={[{ name: 'Menüde alerjen zorunluluğu', path: canonical }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqGraph) }} />

      <header className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.copy}>
            <p className="subpage-eyebrow">Gıda bilgisi zorunluluğu</p>
            <h1 className="font-display">Menüde şeffaf bilgi. Masada bilinçli seçim.</h1>
            <p className={styles.answer}>
              Alerjen, bileşen ve kalori bilgilerini misafirinize açıkça sunun. İşletmeniz için geçerli
              bildirim takvimini öğrenin; menü bilgilerinizi <strong>tek bir karekoddan</strong> erişilebilir tutun.
            </p>
            <p className={styles.conversionTitle}>Menünüzü yeni bilgilendirme gerekliliklerine hazırlayın.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryCta} href="/iletisim?subject=business#satis-formu" data-conversion-event="demo_request_click">
                Ücretsiz Kurulum Görüşmesi<span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondaryCta} href={`${DASHBOARD_URL}/auth/signup?plan=pro&interval=monthly`}>
                14 Gün Ücretsiz Dene
              </Link>
            </div>
            <p className={styles.disclaimer}>Menü bilgilerinin doğruluğu ve güncelliği işletmenin sorumluluğundadır. Masabu, bu bilgilerin müşterilere dijital olarak sunulmasını kolaylaştırır; hukuki uyumluluk garantisi vermez.</p>
            <a className={styles.secondaryCta} href="#uyum-takvimi">Uyum takvimini inceleyin <span aria-hidden="true">↓</span></a>
          </div>

          <div className={styles.heroVisual}>
            <Image
              className={styles.illustration}
              src="/illustrations/menu-regulation.svg"
              alt="İşletmeci ve masa karekodunun yanında, ürünün içindekiler ve alerjen bilgilerini gösteren dijital menü çizimi."
              width={640}
              height={480}
              sizes="(max-width: 800px) 100vw, 50vw"
              priority
            />
            <aside className={styles.countdown} aria-label="Bileşen bildirimi uyum tarihi">
              <div className={styles.countdownValue}>
                <span className={styles.countdownNum}>{mainDeadlinePassed ? '2026' : daysLeft}</span>
                <span className={styles.countdownUnit}>{mainDeadlinePassed ? 'takvimi' : daysLeft === 0 ? 'son gün' : 'gün kaldı'}</span>
              </div>
              <p className={styles.countdownDate}>
                <strong><time dateTime={MAIN_DEADLINE_ISO}>31 Aralık 2026</time></strong>
                Bileşen bildirimi uyum tarihi. İşletme kapsamınızı aşağıdaki takvimden kontrol edin.
              </p>
            </aside>
          </div>
        </div>
      </header>

      <section className={styles.section} id="uyum-takvimi" aria-labelledby="uyum-takvimi-title">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="subpage-eyebrow">Uyum takvimi</p>
            <h2 id="uyum-takvimi-title" className={`font-display ${styles.sectionTitle}`}>Sizi hangi tarih bağlıyor?</h2>
            <p className={styles.sectionLead}>
              Son tarihiniz işletme büyüklüğünüze ve bildirmeniz gereken bilgiye göre değişiyor.
            </p>
          </div>

          <p className={styles.contextNote}>
            <strong>Alerjen bildirimi yeni değil.</strong> Toplu tüketim yerlerinde 1 Ocak 2020’den beri
            zorunlu. Aşağıdaki takvim, genişletilen bileşen ve enerji bildiriminin uyum sürelerini gösterir.{' '}
            <a className={styles.sourceLink} href={REGULATION_SOURCE.url} rel="noopener noreferrer" target="_blank">
              Bakanlık açıklaması<span aria-hidden="true"> ↗</span>
            </a>
          </p>

          <div className={styles.tableScroll} role="region" aria-label="İşletme türüne göre uyum takvimi; dar ekranlarda yatay kaydırılabilir" tabIndex={0}>
            <table className={styles.table}>
              <caption className="sr-only">Bileşen ve enerji bildirimi için işletme türüne göre son tarihler</caption>
              <thead>
                <tr>
                  <th scope="col">İşletme</th>
                  <th scope="col">Bildirilecek bilgi</th>
                  <th scope="col">Son tarih</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {COMPLIANCE_ROWS.map((row) => {
                  const passed = hasDeadlinePassed(today, row.deadlineIso)
                  const isMain = !passed && row.deadlineIso === MAIN_DEADLINE_ISO
                  return (
                    <tr
                      key={`${row.who}-${row.deadlineIso}-${row.scope}`}
                      className={passed ? styles.rowPassed : isMain ? styles.rowActive : undefined}
                    >
                      <td>{row.who}</td>
                      <td>{row.scope}</td>
                      <td className={styles.dateCell}><time dateTime={row.deadlineIso}>{row.deadline}</time></td>
                      <td>
                        {passed ? (
                          <span className={`${styles.badge} ${styles.badgePassed}`}>Yürürlükte</span>
                        ) : isMain ? (
                          <span className={`${styles.badge} ${styles.badgeNow}`}>{daysLeft === 0 ? 'Son gün' : `${daysLeft} gün`}</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeLater}`}>Sonraki dönem</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className={styles.source}>
            Takvim kaynağı: {COMPLIANCE_SOURCE.name}.{' '}
            <a className={styles.sourceLink} href={COMPLIANCE_SOURCE.url} rel="noopener noreferrer" target="_blank">
              Uyum süreleri duyurusunu inceleyin
            </a>
            . Bu sayfa bilgilendirme amaçlıdır ve hukuki görüş yerine geçmez; işletmenizin kapsamını bağlı
            olduğunuz il müdürlüğü veya danışmanınızla teyit edin.
          </p>
        </div>
      </section>

      <section className={styles.sectionAlt} aria-labelledby="nasil-bildirilir-title">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className="subpage-eyebrow">İzin verilen yöntemler</p>
            <h2 id="nasil-bildirilir-title" className={`font-display ${styles.sectionTitle}`}>Menüyü yeniden bastırmanız gerekmiyor.</h2>
            <p className={styles.sectionLead}>
              Bilgilendirme; tüketicinin kolayca görebileceği ve açıkça okuyabileceği olmak koşuluyla şu
              araçlarla yapılabilir. Karekod, menü bilgilerini yeniden baskı yapmadan güncellemenizi sağlar.
            </p>
          </div>

          <div className={styles.methods}>
            {DECLARATION_METHODS.map((method, index) => (
              <div key={method.label} className={`${styles.method} ${method.highlight ? styles.methodOn : ''}`}>
                <span className={styles.methodNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                {method.highlight && <span className={styles.methodTag}>masabu bunu kullanır</span>}
                <span className={styles.methodName}>{method.label}</span>
                <span className={styles.methodNote}>{method.note}</span>
              </div>
            ))}
          </div>
          <p className={styles.methodFootnote}>
            <strong>Karekodun yanında kısa bir bilgilendirme bulundurun.</strong> Bilgilere karekodla
            erişilebildiğini ve cihazı olmayan misafirlere talep halinde sunulacağını görünür biçimde belirtin.{' '}
            <a className={styles.sourceLink} href={COMPLIANCE_SOURCE.url} rel="noopener noreferrer" target="_blank">Uygulama koşulları</a>
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="alerjenler-title">
        <div className={`container ${styles.detailsGrid}`}>
          <div className={styles.detailCopy}>
            <p className="subpage-eyebrow">Bakanlık listesi</p>
            <h2 id="alerjenler-title" className={`font-display ${styles.sectionTitle}`}>14 temel alerjen</h2>
            <p className={styles.sectionLead}>
              Her ürün için bu listeden hangilerini içerdiğini belirtmeniz gerekiyor. Aşağıdaki liste, masabu
              menü düzenleyicisinde karşınıza çıkan listeyle birebir aynıdır.
            </p>
            <Image
              className={styles.detailArt}
              src="/illustrations/menu-regulation-details.svg"
              alt="Ürün kartında bileşenler, içerdiği gluten ve süt alerjenleri ile olası çapraz temas uyarısının ayrı gösterildiği örnek çizim."
              width={640}
              height={480}
              sizes="(max-width: 800px) 100vw, 50vw"
            />
          </div>

          <ul className={styles.allergens} aria-label="14 temel alerjen">
            {ALLERGENS.map((allergen, index) => (
              <li key={allergen.code} className={styles.allergen}>
                <span className={styles.allergenNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.allergenName}>{allergen.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.sectionAlt} aria-labelledby="masabu-ile-title">
        <div className={`container ${styles.workflow}`}>
          <div className={styles.workflowCopy}>
            <p className="subpage-eyebrow">masabu ile adım adım</p>
            <h2 id="masabu-ile-title" className={`font-display ${styles.sectionTitle}`}>Bilgi panelde güncellenir. Misafire menüden ulaşır.</h2>
            <p className={styles.sectionLead}>
              Masabu ürün bileşenleri, alerjenler, enerji / kalori bilgileri, çapraz bulaşma uyarıları ve diğer ürün açıklamalarını ürünün bir parçası olarak tutar;
              bilgiyi ayrı bir dosyada değil, misafirin gördüğü menüde yönetirsiniz.
            </p>
            <ol className={styles.steps}>
              {PRODUCT_STEPS.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepBody}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.textLinks}>
              <Link href="/qr-menu">QR Menü’yü inceleyin<span aria-hidden="true"> ↗</span></Link>
              <Link href="/qr-siparis">QR Sipariş’i keşfedin<span aria-hidden="true"> ↗</span></Link>
            </div>
          </div>
          <figure className={styles.workflowArt}>
            <Image
              className={styles.illustration}
              src="/illustrations/menu-regulation-workflow.svg"
              alt="Menü panelindeki bileşen, alerjen ve porsiyon bilgilerinin aynı masa karekodu üzerinden misafirin telefonuna ulaşmasını anlatan çizim."
              width={640}
              height={480}
              sizes="(max-width: 800px) 100vw, 50vw"
            />
            <figcaption>Tek menü kaynağı, aynı karekod. Çizimler ürün akışını temsili olarak gösterir.</figcaption>
          </figure>
        </div>
      </section>

      <section id="sss" className="faq-section story-section">
        <div className="story-container story-container--narrow">
          <div className="story-heading story-heading--split">
            <div>
              <span>Sık sorulanlar</span>
              <h2 className="font-display">Zorunluluk hakkında merak edilenler.</h2>
            </div>
            <p>Kapsam, yöntem ve uygulama hakkında en çok sorulan sorular.</p>
          </div>
          <FAQAccordion items={REGULATION_FAQS} />
        </div>
      </section>

      <TrialSection />
    </MarketingPage>
  )
}

export const MENU_REGULATION_CANONICAL = '/menu-alerjen-zorunlulugu'
export const MENU_REGULATION_ORIGIN_URL = `${SITE_ORIGIN}${MENU_REGULATION_CANONICAL}`
