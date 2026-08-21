'use client'

import { AppIcons as I } from '@garsonless/ui/icons'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const PRINCIPLES = [
  {
    title: 'Tek operasyon kaydı',
    description: 'Menü, masa, sipariş, mutfak ve tahsilat aynı restoran verisi etrafında ilerler.',
    Icon: I.link2,
  },
  {
    title: 'İşletmenin kontrolü',
    description: 'İçerik, görünüm, ekip yetkileri ve operasyon kararları işletmenin elinde kalır.',
    Icon: I.shield,
  },
  {
    title: 'Ölçülü teknoloji',
    description: 'Her özellik gerçek bir servis sorununu çözmeli; işletmeye yeni iş veya yeni karmaşa eklememelidir.',
    Icon: I.sparkles,
  },
] as const

const DESKTOP_PATH = 'M0 20H1120Q1160 20 1160 60V100Q1160 140 1120 140H120Q80 140 80 180V320Q80 360 120 360H1120Q1160 360 1160 400V540Q1160 580 1120 580H120Q80 580 80 620V720Q80 760 120 760H1200'
const MOBILE_PATH = 'M20 0V900'

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function AboutPrinciples() {
  const rootRef = useRef<HTMLElement>(null)
  const frameRef = useRef(0)
  const [progress, setProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    if (reducedMotion) {
      setProgress(1)
      return
    }

    const update = () => {
      frameRef.current = 0
      const rect = root.getBoundingClientRect()
      const viewport = window.innerHeight
      const travel = Math.max(1, rect.height - viewport * .34)
      const next = clamp((viewport * .18 - rect.top) / travel)
      setProgress((current) => Math.abs(current - next) < .002 ? current : next)
    }

    const requestUpdate = () => {
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [reducedMotion])

  const activeIndex = Math.min(PRINCIPLES.length - 1, Math.floor(progress * PRINCIPLES.length))
  const lineStyle = { strokeDashoffset: 100 - progress * 100 } as CSSProperties

  return (
    <section
      ref={rootRef}
      className="about-principles story-section"
      aria-labelledby="about-principles-title"
      data-reduced-motion={reducedMotion}
      style={{ '--about-principles-progress': progress } as CSSProperties}
    >
      <div className="story-container">
        <header className="about-principles__heading">
          <div className="about-principles__eyebrow-line">
            <span>Ürün yaklaşımı</span>
          </div>
          <h2 id="about-principles-title" className="font-display">Bizi yönlendiren üç ilke.</h2>
        </header>

        <div className="about-values__stage">
          <svg className="about-values__path about-values__path--desktop" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
            <path className="about-values__path-track" d={DESKTOP_PATH} pathLength="100" />
            <path className="about-values__path-progress" d={DESKTOP_PATH} pathLength="100" style={lineStyle} />
          </svg>
          <svg className="about-values__path about-values__path--mobile" viewBox="0 0 40 900" preserveAspectRatio="none" aria-hidden="true">
            <path className="about-values__path-track" d={MOBILE_PATH} pathLength="100" />
            <path className="about-values__path-progress" d={MOBILE_PATH} pathLength="100" style={lineStyle} />
          </svg>

          <ol className="about-values__list">
            {PRINCIPLES.map(({ title, description, Icon }, index) => (
              <li
                key={title}
                data-active={reducedMotion || index === activeIndex}
                data-complete={reducedMotion || index < activeIndex}
              >
                <article>
                  <div className="about-value__title">
                    <span className="about-value__icon" aria-hidden="true"><Icon size={22} /></span>
                    <h3>{title}</h3>
                  </div>
                  <p>{description}</p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
