import type { Metadata } from 'next'
import { marketingMetadata } from '../../lib/seo'
import { BusinessContactForm } from '../../components/BusinessContactForm'
import { MarketingPage } from '../../components/MarketingPage'
import { LEGAL_IDENTITY } from '../../lib/legal-identity'

export const metadata: Metadata = marketingMetadata({
  title: 'İletişim | masabu',
  description: 'masabu satış, destek ve genel iletişim kanalları.',
  canonical: '/iletisim',
})

export default function ContactPage() {
  return (
    <MarketingPage breadcrumbs={[{ name: 'İletişim', path: '/iletisim' }]}>
      <section className="contact-page">
        <div className="container contact-page__grid">
          <div className="contact-page__content">
            <header className="contact-page__heading">
              <p className="subpage-eyebrow">İletişim</p>
              <h1 className="font-display">Size nasıl yardımcı olabiliriz?</h1>
              <p>masabu hakkında merak ettiklerinizi, kurulum ihtiyacınızı veya destek talebinizi bize iletin.</p>
            </header>

            <div className="contact-page__cards">
              <article className="contact-channel-card">
                <p>Destek</p>
                <h2>Mevcut işletmeler için</h2>
                <span>Hesap ve kullanım sorularınız için işletme adınızla birlikte bize yazın.</span>
                <a href={`mailto:${LEGAL_IDENTITY.supportEmail}`}>{LEGAL_IDENTITY.supportEmail}</a>
              </article>
              <article className="contact-channel-card">
                <p>Bilgi merkezi</p>
                <h2>Ürünü yakından tanıyın</h2>
                <span>QR menü, operasyon ve ürün yönetimi rehberlerini inceleyin.</span>
                <a href="/blog">Blogu görüntüle</a>
              </article>
            </div>

            <address className="contact-page__identity">
              <strong>{LEGAL_IDENTITY.proprietor}</strong>
              <span>İletişim saatleri: Hafta içi 09.00–18.00 (Türkiye saati)</span>
              <span>{LEGAL_IDENTITY.entityType} · {LEGAL_IDENTITY.taxOffice} · VKN {LEGAL_IDENTITY.taxNumber}</span>
              <span>{LEGAL_IDENTITY.address}</span>
              <a href={`mailto:${LEGAL_IDENTITY.generalEmail}`}>{LEGAL_IDENTITY.generalEmail}</a>
            </address>
          </div>

          <div id="satis-formu" className="contact-page__form-column">
            <BusinessContactForm />
          </div>
        </div>
      </section>
    </MarketingPage>
  )
}
