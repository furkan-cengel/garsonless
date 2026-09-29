import { AppIcons as I } from '@garsonless/ui/icons'
import { HeroFlow } from './HeroFlow'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

export function HeroSection() {
  return (
    <section className="marketing-hero" aria-labelledby="marketing-hero-title">
      <div className="marketing-hero__glow" aria-hidden="true" />
      <div className="container marketing-hero__inner">
        <div className="marketing-hero__copy">
          <h1 id="marketing-hero-title" className="font-display marketing-hero__title">
            Menüden hesaba,<br />
            <span>müşteri artık garson beklemez.</span>
          </h1>
          <div className="marketing-hero__details">
            <p className="marketing-hero__lead">
              Misafirleriniz içerik ve alerjen bilgilerini inceler, masadan sipariş verir, servis talebi oluşturur ve hesap sürecini yönetir. Ekibiniz tüm akışı tek ekrandan takip eder.
            </p>
            <div className="marketing-hero__actions">
              <a className="marketing-hero__primary" href={`${DASHBOARD_URL}/auth/signup`}>
                14 Gün Ücretsiz Dene
              </a>
              <a className="marketing-hero__secondary" href="#demo">
                Nasıl Çalıştığını Gör <I.arrow size={16} />
              </a>
            </div>
            <p className="marketing-hero__trust">Kredi kartı gerekmez · Taahhüt yok · Sipariş komisyonu yok</p>
          </div>
        </div>

        <HeroFlow />
      </div>
    </section>
  )
}
