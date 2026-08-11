'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MI } from '../lib/icons'
import { problemSolutionConfig, type MarketingIconName } from './marketingStory'

function StoryIcon({ name, size = 20 }: { name: MarketingIconName; size?: number }) {
  const Icon = MI[name]
  return <Icon size={size} />
}

export function ProblemSolutionSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const solutionPanelRef = useRef<HTMLElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [isSolutionInView, setIsSolutionInView] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [cycle, setCycle] = useState(0)
  const [solutionCycle, setSolutionCycle] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const solutionPanel = solutionPanelRef.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setReducedMotion(media.matches)
    const updateTabVisibility = () => setIsTabVisible(document.visibilityState === 'visible')

    updateMotionPreference()
    updateTabVisibility()

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry?.isIntersecting ?? false),
      { threshold: 0.22 },
    )

    const solutionObserver = new IntersectionObserver(
      ([entry]) => setIsSolutionInView(entry?.isIntersecting ?? false),
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    )

    if (section) observer.observe(section)
    if (solutionPanel) solutionObserver.observe(solutionPanel)
    media.addEventListener('change', updateMotionPreference)
    document.addEventListener('visibilitychange', updateTabVisibility)

    return () => {
      observer.disconnect()
      solutionObserver.disconnect()
      media.removeEventListener('change', updateMotionPreference)
      document.removeEventListener('visibilitychange', updateTabVisibility)
    }
  }, [])

  const isPlaying = isInView && !reducedMotion
  const isSolutionPlaying = isSolutionInView && !reducedMotion
  const isPaused = (isPlaying || isSolutionPlaying) && !isTabVisible

  useEffect(() => {
    if (!isPlaying) return

    setCycle((current) => current + 1)
  }, [isPlaying])

  useEffect(() => {
    if (!isSolutionPlaying) return

    setSolutionCycle((current) => current + 1)
  }, [isSolutionPlaying])

  return (
    <section
      ref={sectionRef}
      id="özellikler"
      className={`problem-solution story-section story-section--dark ${
        reducedMotion ? 'problem-solution--static' : 'problem-solution--animated'
      } ${isPlaying ? 'is-playing' : ''} ${isSolutionPlaying ? 'is-solution-playing' : ''} ${isPaused ? 'is-paused' : ''}`}
    >
      <div className="story-container">
        <div className="problem-solution__intro">
          <h2 className="font-display">
            Sipariş almak zorlaşmadı.<br />
            <span>Dağınıklaştı.</span>
          </h2>
          <div className="problem-solution__copy">
            <p>
              Masalar, mutfak ve kasa ayrı akışlarda ilerlediğinde ekip sürekli bilgi taşır;
              siparişin nerede olduğunu anlamak gereksiz zaman alır.
            </p>
            <p>
              Masabu QR menüyü, sipariş akışını, mutfak durumunu ve tahsilatı aynı masa kaydı
              etrafında birleştirir. Ekip tek akışı izler, misafir ne durumda olduğunu bilir.
            </p>
          </div>
        </div>

        <div className="problem-solution__panels">
          <article className="flow-panel flow-panel--problem" aria-label="Dağınık servis akışı">
            <p className="flow-panel__label">Servisiniz bir <strong>karmaşa</strong></p>
            <div className="problem-network" aria-hidden="true" key={`problem-${cycle}`}>
              {[1, 2, 3, 4, 5].map((line, index) => (
                <i
                  key={line}
                  className={`problem-network__line problem-network__line--${line}`}
                  style={{ animationDelay: `${index * 110}ms` }}
                />
              ))}
              {problemSolutionConfig.problemNodes.map((node, index) => (
                <span
                  key={node.label}
                  className="problem-network__node"
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    animationDelay: `${200 + index * 150}ms`,
                  }}
                >
                  <Image src={node.asset} alt="" width={20} height={20} />
                </span>
              ))}
            </div>
          </article>

          <article
            ref={solutionPanelRef}
            className="flow-panel flow-panel--solution"
            aria-label="Masabu ile tekilleşmiş servis akışı"
          >
            <p className="flow-panel__label">Masabu ile <strong>toparlayın</strong></p>
            <div className="solution-routes" key={`solution-${solutionCycle}`}>
              {problemSolutionConfig.solutionLanes.map((lane, laneIndex) => (
                <section
                  className={`solution-route solution-route--${lane.id} solution-route--${lane.tone}`}
                  key={lane.id}
                  aria-labelledby={`solution-route-${lane.id}`}
                >
                  <h3 className="solution-route__title" id={`solution-route-${lane.id}`}>
                    {lane.title}
                  </h3>
                  <ol
                    className="solution-route__list"
                    style={
                      {
                        '--route-step-count': lane.steps.length,
                        '--route-line-delay': `${lane.tone === 'primary' ? 420 : 120 + laneIndex * 120}ms`,
                      } as CSSProperties
                    }
                  >
                    {lane.steps.map((route, index) => {
                      const isFinalPrimaryStep = lane.tone === 'primary' && index === lane.steps.length - 1

                      return (
                        <li
                          className="solution-route__step"
                          key={route.label}
                          style={{
                            animationDelay: `${lane.tone === 'primary' ? 620 + index * 145 : 220 + laneIndex * 120 + index * 70}ms`,
                          }}
                        >
                          <span
                            className={`solution-route__artwork ${route.asset ? 'solution-route__artwork--asset' : ''} ${lane.id === 'middle' && index === 3 ? 'solution-route__artwork--wide' : ''}`}
                          >
                            {route.asset ? (
                              <Image src={route.asset} alt="" width={100} height={100} />
                            ) : route.icon ? (
                              <StoryIcon name={route.icon} size={21} />
                            ) : null}
                            {isFinalPrimaryStep ? (
                              <span
                                className="solution-route__terminal"
                                aria-label="Akış tamamlandı"
                                style={{ animationDelay: `${760 + lane.steps.length * 145}ms` }}
                              >
                                <MI.check size={14} aria-hidden="true" />
                              </span>
                            ) : null}
                          </span>
                          <span className="solution-route__step-label">{route.label}</span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
