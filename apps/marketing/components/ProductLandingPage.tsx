import Link from 'next/link'
import Image from 'next/image'
import { canUseFeature, PLAN_PRICES } from '@garsonless/domain/entitlements'
import { MARKETING_PLANS } from '../lib/pricing-catalog'
import { PRODUCT_PAGES, type ProductPage } from '../lib/product-pages'
import { MarketingPage, PageHero } from './MarketingPage'
import { TrialSection } from './TrialSection'

export function ProductLandingPage({ product }: { product: ProductPage }) {
  const plans = MARKETING_PLANS.filter((plan) => canUseFeature(plan.id, product.feature))
  return <MarketingPage breadcrumbs={[{ name: product.name, path: `/${product.slug}` }]}>
    <PageHero eyebrow={product.name} title={product.heading} description={product.description} />
    <section className="seo-product-section">
      <div className="container seo-product-grid">
        <div><h2>{product.name} işletmenizde nasıl çalışır?</h2><p>{product.problem}</p>
          <ol>{product.workflow.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="seo-product-links"><Link href="/#demo">Etkileşimli ürün turlarını inceleyin</Link><Link href={`/blog/${product.guide}`}>Uygulama rehberini okuyun</Link></div>
        </div>
        <figure><Image src={product.image} alt={product.imageAlt} width={1422} height={800} sizes="(max-width: 700px) 100vw, 50vw" /><figcaption>{product.imageAlt}</figcaption></figure>
      </div>
    </section>
    <section className="seo-product-section"><div className="container seo-product-grid">
      {product.details.map((detail) => <article key={detail.title}><h2>{detail.title}</h2><p>{detail.body}</p></article>)}
    </div></section>
    <section className="seo-product-section"><div className="container">
      <h2>{product.name} hangi paketlerde var?</h2>
      <div className="seo-product-links">{plans.map((plan) => <Link key={plan.id} href="/fiyatlar">
        {plan.name}{plan.id !== 'business' ? ` — ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(PLAN_PRICES[plan.id].monthly.amountMinor / 100)}/ay + KDV` : ' — özel teklif'}
      </Link>)}</div>
      <p>14 günlük Pro denemesinde kart bilgisi gerekmez. Paket kapsamı, yıllık ödeme ve ek hizmetleri <Link href="/fiyatlar">fiyat karşılaştırmasında</Link> inceleyin.</p>
    </div></section>
    <section className="seo-product-section"><div className="container seo-product-faq"><h2>Sık sorulan sorular</h2>
      {product.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
    </div></section>
    <nav className="container seo-product-links" aria-label="İlgili ürünler">{PRODUCT_PAGES.filter((item) => item.slug !== product.slug).map((item) => <Link href={`/${item.slug}`} key={item.slug}>{item.name}</Link>)}</nav>
    <TrialSection />
  </MarketingPage>
}
