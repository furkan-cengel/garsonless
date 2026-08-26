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
            Garsonsuz sipariş,<br />
            <span>kusursuz servis.</span>
          </h1>
          <p className="marketing-hero__lead">
            Misafir masadaki QR&apos;ı tarar, menüden seçer, öder. Siz her masayı,
            her siparişi ve tüm cironuzu tek panodan yönetirsiniz.
          </p>
          <div className="marketing-hero__actions">
            <a className="marketing-hero__primary" href={`${DASHBOARD_URL}/auth/signup`}>
              Ücretsiz dene
            </a>
            <a className="marketing-hero__secondary" href="#demo">
              Nasıl çalışır <I.arrow size={16} />
            </a>
          </div>
        </div>

        <HeroFlow />
      </div>
    </section>
  )
}
