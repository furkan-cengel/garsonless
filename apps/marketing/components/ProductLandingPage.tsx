import Link from 'next/link'
import Image from 'next/image'
import { canUseFeature, PLAN_PRICES } from '@garsonless/domain/entitlements'
import { MARKETING_PLANS } from '../lib/pricing-catalog'
import { type ProductPage } from '../lib/product-pages'
import { MarketingPage } from './MarketingPage'
import { TrialSection } from './TrialSection'
import { FAQAccordion } from './FAQAccordion'
import styles from './ProductLandingPage.module.css'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

export function ProductLandingPage({ product }: { product: ProductPage }) {
  const plans = MARKETING_PLANS.filter((plan) => canUseFeature(plan.id, product.feature))
  const workflowArt = product.workflowIllustration
  return <MarketingPage breadcrumbs={[{ name: product.name, path: `/${product.slug}` }]}>
    <header className={styles.hero}>
      <div className={`container ${styles.heroGrid}`}>
        <div className={styles.copy}>
          <p className="subpage-eyebrow">{product.name}</p>
          <h1 className="font-display">{product.heading}</h1>
          <p className={styles.description}>{product.description}</p>
        </div>
        <Image className={styles.illustration} src={`/illustrations/${product.slug}.svg`} alt={product.illustrationAlt} width={640} height={480} sizes="(max-width: 800px) 100vw, 50vw" priority />
      </div>
    </header>
    <section className={styles.section}>
      <div className={`container ${styles.workflow} ${workflowArt ? styles.workflowIllustrated : ''}`}>
        <div className={styles.workflowCopy}>
          <p className="subpage-eyebrow">Nasıl çalışır?</p>
          <h2 className={`font-display ${styles.sectionTitle}`}>{product.name} işletmenizde nasıl çalışır?</h2>
          <p className={styles.body}>{product.problem}</p>
          <ol className={styles.steps}>{product.workflow.map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span><p>{step}</p></li>)}</ol>
          <div className={styles.textLinks}><Link href="/#demo">Ürün turlarını inceleyin <span aria-hidden="true">↗</span></Link><Link href={`/blog/${product.guide}`}>Uygulama rehberi <span aria-hidden="true">↗</span></Link></div>
        </div>
        <figure className={styles.workflowArt}>
          <Image src={workflowArt?.src ?? product.image} alt={workflowArt?.alt ?? product.imageAlt} width={workflowArt ? 640 : 1422} height={workflowArt ? 480 : 800} sizes="(max-width: 800px) 100vw, 50vw" />
          {!workflowArt && <figcaption>{product.imageAlt}</figcaption>}
        </figure>
      </div>
    </section>
    <section className={styles.detailsSection}><div className={`container ${styles.detailsGrid}`}>
      {product.details.map((detail) => <article key={detail.title} className={styles.detail}>
        <h2 className={`font-display ${styles.detailTitle}`}>{detail.title}</h2>
        <p className={styles.body}>{detail.body}</p>
        {detail.illustration && <Image className={styles.detailArt} src={detail.illustration.src} alt={detail.illustration.alt} width={640} height={480} sizes="(max-width: 800px) 100vw, 50vw" />}
      </article>)}
    </div></section>
    <section className={styles.plansSection} aria-labelledby="product-plans-title"><div className="container">
      <div className={styles.plansHeading}>
        <div><p className="subpage-eyebrow">İşletmenize uygun kapsam</p><h2 id="product-plans-title" className={`font-display ${styles.sectionTitle}`}>{product.name} hangi paketlerde var?</h2></div>
        <p>14 gün boyunca Pro özelliklerini deneyin. Kart bilgisi gerekmez.</p>
      </div>
      <div className={`${styles.planGrid} ${plans.length === 4 ? styles.planGridFour : ''}`}>{plans.map((plan) => {
        const features = product.slug === 'mutfak-ekrani' && plan.id === 'pro'
          ? ['Mutfak ekranı ve hazırlık istasyonları', 'Müşteri sepeti ve QR siparişi', 'Personel siparişi ve dijital adisyon', 'Gelişmiş raporlar ve bildirimler']
          : plan.features.slice(0, 4)
        return <article key={plan.id} className={`${styles.planCard} ${plan.highlight ? styles.planFeatured : ''}`}>
          <div className={styles.planTop}><h3>{plan.name}</h3><span>{plan.id === 'business' ? 'Çok şubeli işletmeler' : plan.highlight ? '14 gün ücretsiz deneme' : 'Aylık abonelik'}</span></div>
          <p className={styles.planDescription}>{plan.description}</p>
          <div className={styles.price}>{plan.id === 'business' ? <strong>Size özel teklif</strong> : <><strong>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(PLAN_PRICES[plan.id].monthly.amountMinor / 100)}</strong><span>/ ay + KDV</span></>}</div>
          <ul className={styles.planFeatures}>{features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
          <Link className={styles.planCta} href={plan.id === 'business' ? '/iletisim?subject=business#satis-formu' : `${DASHBOARD_URL}/auth/signup?plan=${plan.id}&interval=monthly`}>{plan.id === 'business' ? 'İhtiyacınızı konuşalım' : '14 gün ücretsiz deneyin'}<span aria-hidden="true">↗</span></Link>
        </article>
      })}</div>
      <div className={styles.planFootnote}><p>Yıllık ödeme seçenekleri ve ek hizmetler için tüm paketleri karşılaştırın.</p><Link href="/fiyatlar">Paketleri karşılaştırın <span aria-hidden="true">→</span></Link></div>
    </div></section>
    <section id="sss" className="faq-section story-section">
      <div className="story-container story-container--narrow">
        <div className="story-heading story-heading--split"><div><span>Sık sorulanlar</span><h2 className="font-display">Başlamadan önce bilmeniz gerekenler.</h2></div><p>{product.name} kapsamı ve kullanımı hakkında merak ettikleriniz.</p></div>
        <FAQAccordion items={product.faqs} />
      </div>
    </section>
    <TrialSection />
  </MarketingPage>
}
