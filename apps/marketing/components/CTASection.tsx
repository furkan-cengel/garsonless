import { MI } from '../lib/icons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

export function CTASection() {
  return (
    <section className="final-cta story-section">
      <div className="story-container">
        <div className="final-cta__panel grain">
          <div className="final-cta__copy">
            <span><MI.sparkles size={16} /> 14 günlük Pro denemesi</span>
            <h2 className="font-display">Servis akışını bugün<br /><em>tek yerde toplayın.</em></h2>
            <p>
              Menünüzü, masalarınızı ve ekibinizi Masabu ile yönetin; Pro özelliklerini 14 gün
              boyunca gerçek operasyonunuzda deneyin.
            </p>
            <div>
              <a className="final-cta__primary" href={`${DASHBOARD_URL}/auth/signup`}>
                14 gün ücretsiz dene <MI.arrow size={17} />
              </a>
              <a className="final-cta__secondary" href="#demo">Nasıl çalışır <MI.arrowDown size={17} /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
