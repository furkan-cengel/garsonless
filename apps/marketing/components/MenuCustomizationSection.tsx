'use client'

import { useEffect, useRef, useState } from 'react'
import { MI } from '../lib/icons'
import { customizationFeatures, type CustomizationFeature, type MarketingIconName } from './marketingStory'

function StoryIcon({ name, size = 17 }: { name: MarketingIconName; size?: number }) {
  const Icon = MI[name]
  return <Icon size={size} />
}

function FeatureList({ items, duplicate = false }: { items: CustomizationFeature[]; duplicate?: boolean }) {
  return (
    <div className="customization-marquee__group" aria-hidden={duplicate || undefined}>
      {items.map((feature) => (
        <div className="customization-feature" key={`${feature.label}-${duplicate ? 'duplicate' : 'original'}`}>
          <span>{feature.label}</span>
          <i />
          <strong><StoryIcon name={feature.icon} /> {feature.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function MenuCustomizationSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const midpoint = Math.ceil(customizationFeatures.length / 2)
  const left = customizationFeatures.slice(0, midpoint)
  const right = customizationFeatures.slice(midpoint)

  useEffect(() => {
    if (!sectionRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.12 },
    )
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="menu-ozellestirme" ref={sectionRef} className="menu-customization story-section story-section--dark" data-visible={visible}>
      <div className="story-container">
        <div className="menu-customization__heading">
          <h2 className="font-display">Menünüz, tam <span>istediğiniz gibi.</span></h2>
          <p>
            Varyanttan alerjen bilgisine, önerilerden QR görünümüne kadar ürünlerinizi işletmenize
            göre şekillendirin.
          </p>
        </div>

        <div className="menu-customization__stage">
          <div className="customization-marquee customization-marquee--up">
            <div className="customization-marquee__track">
              <FeatureList items={left} />
              <FeatureList items={left} duplicate />
            </div>
          </div>

          <div className="menu-customization__center">
            <span><MI.sparkles size={18} /> Tek panelden</span>
            <h3 className="font-display">Her üründe<br /><em>tam kontrol</em></h3>
            <p>Menü içeriğini, görünümünü ve sipariş kurallarını kod yazmadan yönetin.</p>
          </div>

          <div className="customization-marquee customization-marquee--down">
            <div className="customization-marquee__track">
              <FeatureList items={right} />
              <FeatureList items={right} duplicate />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
