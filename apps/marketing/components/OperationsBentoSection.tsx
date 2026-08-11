import Image from 'next/image'
import { MI } from '../lib/icons'
import { capabilityCards, type MarketingIconName } from './marketingStory'

function StoryIcon({ name, size = 20 }: { name: MarketingIconName; size?: number }) {
  const Icon = MI[name]
  return <Icon size={size} />
}

export function OperationsBentoSection() {
  return (
    <section className="operations-bento story-section">
      <div className="story-container">
        <div className="story-heading story-heading--split">
          <div>
            <span>Tek ürün, tüm operasyon</span>
            <h2 className="font-display">Servisin görünen ve görünmeyen tarafı birlikte.</h2>
          </div>
          <p>
            Menüden masalara, müşteriden ekibe kadar işletmenin temel yüzeyleri aynı veri modeliyle
            birlikte çalışır.
          </p>
        </div>

        <div className="operations-bento__grid">
          {capabilityCards.map((card) => (
            <article className="capability-card" data-tone={card.tone} key={card.title}>
              <div className="capability-card__media">
                <Image src={card.poster} alt={card.posterAlt} fill sizes="(max-width: 760px) 92vw, 560px" />
              </div>
              <div className="capability-card__body">
                <span className="capability-card__icon"><StoryIcon name={card.icon} /></span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <ul>
                  {card.benefits.map((benefit) => <li key={benefit}><MI.check size={14} /> {benefit}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
