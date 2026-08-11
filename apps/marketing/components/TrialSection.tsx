import { MI } from '../lib/icons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const trialFacts = [
  'Pro özelliklerini 14 gün boyunca dene',
  'Abonelik başlamazsa ücretsiz plana dön',
  'Menü ve işletme verilerin korunur',
]

export function TrialSection() {
  return (
    <section id="fiyatlandırma" className="trial-section story-section">
      <div className="story-container">
        <div className="trial-band">
          <div>
            <span className="trial-band__eyebrow"><MI.sparkles size={16} /> 14 günlük Pro denemesi</span>
            <h2 className="font-display">Gerçek serviste deneyin.<br />Kararı sonra verin.</h2>
          </div>
          <div className="trial-band__decision">
            <ul>
              {trialFacts.map((fact) => <li key={fact}><MI.check size={15} /> {fact}</li>)}
            </ul>
            <a href={`${DASHBOARD_URL}/signup`}>14 gün ücretsiz dene <MI.arrow size={17} /></a>
          </div>
        </div>
      </div>
    </section>
  )
}
