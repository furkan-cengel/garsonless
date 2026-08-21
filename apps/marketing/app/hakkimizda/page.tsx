import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { AboutPrinciples } from '../../components/AboutPrinciples'
import { MarketingPage } from '../../components/MarketingPage'
import { TrialSection } from '../../components/TrialSection'
import { LEGAL_IDENTITY } from '../../lib/legal-identity'

export const metadata: Metadata = {
  title: 'Hakkımızda | Masabu',
  description: 'Masabu’nun dijital menüden sipariş, mutfak ve tahsilata uzanan restoran operasyonu yaklaşımını öğrenin.',
  alternates: { canonical: '/hakkimizda' },
}

const OPERATION_AREAS = [
  'Dijital menü',
  'Masa ve sipariş',
  'Mutfak akışı',
  'Tahsilat ve rapor',
] as const

export default function AboutPage() {
  return (
    <MarketingPage>
      <header className="about-hero story-section">
        <div className="about-hero__signal" aria-hidden="true">
          <svg viewBox="0 0 1440 182" preserveAspectRatio="none">
            <path className="about-hero__signal-track" pathLength="100" d="M0 1H1128C1141.25 1 1152 11.7452 1152 25V157C1152 170.255 1162.75 181 1176 181H1440" />
            <path className="about-hero__signal-progress" pathLength="100" d="M0 1H1128C1141.25 1 1152 11.7452 1152 25V157C1152 170.255 1162.75 181 1176 181H1440" />
          </svg>
        </div>
        <div className="story-container about-hero__inner">
          <p className="about-eyebrow about-hero__eyebrow">Hakkımızda</p>
          <h1 className="font-display">
            Restoranın her anını <em>aynı akışta</em> buluşturuyoruz.
          </h1>
          <p className="about-hero__summary">Menüden siparişe, mutfaktan tahsilata.</p>

          <ul className="about-hero__route" aria-label="Masabu ürün akışı">
            {OPERATION_AREAS.map((label, index) => (
              <li key={label} style={{ '--about-route-index': index } as CSSProperties}>
                <span aria-hidden="true" />
                <strong>{label}</strong>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <section className="about-story story-section grain" aria-labelledby="about-story-title">
        <div className="story-container about-story__grid">
          <div className="about-story__copy">
            <p className="about-eyebrow">Neden Masabu?</p>
            <h2 id="about-story-title" className="font-display">
              İyi servis, bilginin doğru anda doğru yerde olmasıyla başlar.
            </h2>
            <div className="about-story__body">
              <p>Bir ürün menüde güncellendiğinde misafirin gördüğü ekrana yansımalı. Sipariş verildiğinde masa, mutfak ve tahsilat aynı durumu takip etmeli. Gün bittiğinde raporlar aynı veriden oluşmalı.</p>
              <p>Masabu; dijital menüyü ayrı, operasyonu ayrı ele alan bir araç değil. Misafirin QR’ı okuttuğu andan siparişin tamamlanmasına kadar restoranın temel işlerini aynı kayıt üzerinde ilerleten bir çalışma alanıdır.</p>
              <p>Amacımız ekibe yeni bir karmaşa öğretmek değil; servisin zaten var olan akışını daha görünür, düzenli ve yönetilebilir hâle getirmektir.</p>
            </div>
          </div>

        </div>
      </section>

      <AboutPrinciples />

      <section className="about-trust" aria-labelledby="about-trust-title">
        <div className="story-container about-trust__grid">
          <div>
            <p className="about-eyebrow">Masabu hakkında</p>
            <h2 id="about-trust-title" className="font-display">Yiyecek-içecek işletmeleri için geliştirilen B2B yazılım.</h2>
          </div>

          <dl className="about-trust__facts">
            <div>
              <dt>İşletme</dt>
              <dd>{LEGAL_IDENTITY.publicName}</dd>
            </div>
            <div>
              <dt>Vergi</dt>
              <dd>{LEGAL_IDENTITY.taxOffice} · VKN {LEGAL_IDENTITY.taxNumber}</dd>
            </div>
            <div>
              <dt>Adres</dt>
              <dd>{LEGAL_IDENTITY.address}</dd>
            </div>
            <div>
              <dt>İletişim</dt>
              <dd><a href="/iletisim">İletişim kanallarını görüntüleyin →</a></dd>
            </div>
          </dl>
        </div>
      </section>

      <TrialSection />
    </MarketingPage>
  )
}
