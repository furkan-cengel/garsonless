'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { MI } from '../lib/icons'
import { processSteps, type MarketingIconName, type ProcessStep } from './marketingStory'
import { getSupademoEmbedUrl, SupademoDialog } from './SupademoDialog'

function StoryIcon({ name, size = 18 }: { name: MarketingIconName; size?: number }) {
  const Icon = MI[name]
  return <Icon size={size} />
}

function safeDemoUrl(step: ProcessStep) {
  if (step.supademoDemo === 'menu-management') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_01_URL)
  }
  if (step.supademoDemo === 'theme-editor') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_02_URL)
  }
  if (step.supademoDemo === 'tables-qr') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_03_URL)
  }
  if (step.supademoDemo === 'dashboard-reports') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_04_URL)
  }
  if (step.supademoDemo === 'customers-loyalty') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_05_URL)
  }
  if (step.supademoDemo === 'team-permissions') {
    return getSupademoEmbedUrl(process.env.NEXT_PUBLIC_SUPADEMO_PROCESS_06_URL)
  }
  return null
}

function InteractiveProcessPoster({
  step,
  demoUrl,
  visible,
}: {
  step: ProcessStep
  demoUrl: string
  visible: boolean
}) {
  const [frameReady, setFrameReady] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)

  return (
    <div
      className="process-poster process-poster--interactive"
      data-supademo-demo={step.supademoDemo}
    >
      <span className="process-poster__browser">
        <i /><i /><i />
        <small>masabu.co</small>
        <em><span /> Etkileşimli demo</em>
      </span>
      <span className="process-poster__image">
        {visible && !frameFailed && (
          <iframe
            title={`${step.eyebrow} etkileşimli ürün turu`}
            src={demoUrl}
            loading="lazy"
            allow="clipboard-write; fullscreen"
            allowFullScreen
            onLoad={() => setFrameReady(true)}
            onError={() => setFrameFailed(true)}
            data-ready={frameReady}
          />
        )}
        {visible && !frameReady && !frameFailed && (
          <span className="process-poster__loading" role="status">Etkileşimli demo yükleniyor…</span>
        )}
        {visible && frameFailed && (
          <span className="process-poster__loading process-poster__loading--error" role="status">
            Etkileşimli demo şu anda yüklenemedi.
          </span>
        )}
      </span>
    </div>
  )
}

function PaymentCartPoster() {
  return (
    <div className="process-poster process-poster--payment" aria-label="Masabu sepet ve ödeme özeti">
      <span className="process-poster__browser">
        <i /><i /><i />
        <small>masabu.co</small>
      </span>
      <span className="payment-poster" aria-hidden="true">
        <span className="payment-poster__phone">
          <span className="payment-poster__handle" />
          <span className="payment-poster__header">
            <span><strong>Sepetiniz</strong><small>1 ürün siparişe hazır</small></span>
            <b>×</b>
          </span>
          <span className="payment-poster__item">
            <span className="payment-poster__thumb">M</span>
            <span><strong>Menemen</strong><small>₺230,00 / adet · Seçenekli</small><em>Pastırmalı · 350 kcal</em></span>
            <b>₺230,00</b>
          </span>
          <span className="payment-poster__quantity"><i>−</i><b>1</b><i>+</i><small>Kaldır</small></span>
          <span className="payment-poster__total"><small>Toplam</small><strong>₺230,00</strong></span>
          <span className="payment-poster__notice">Sipariş vermek için masadaki QR kodunu okutun.</span>
          <span className="payment-poster__button">Masadaki QR kodu okutun</span>
        </span>
      </span>
    </div>
  )
}

export function ProcessFlowSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set())
  const [visibleConnectors, setVisibleConnectors] = useState<Set<number>>(new Set())
  const [activePreview, setActivePreview] = useState<ProcessStep | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const mobileViewport = window.matchMedia('(max-width: 700px)')
    const elements = Array.from(section.querySelectorAll<HTMLElement>('[data-process-step]'))
    const connectors = Array.from(section.querySelectorAll<HTMLElement>('[data-process-connector]'))
    const stepObserver = new IntersectionObserver(
      (entries) => {
        setVisibleSteps((previous) => {
          const next = new Set(previous)
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(Number((entry.target as HTMLElement).dataset.processStep))
          }
          return next
        })
      },
      {
        threshold: mobileViewport.matches ? 0.08 : 0.3,
        rootMargin: mobileViewport.matches ? '0px 0px -4% 0px' : '0px 0px -12% 0px',
      },
    )
    const connectorObserver = new IntersectionObserver(
      (entries) => {
        setVisibleConnectors((previous) => {
          const next = new Set(previous)
          for (const entry of entries) {
            if (entry.isIntersecting) {
              next.add(Number((entry.target as HTMLElement).dataset.processConnector))
            }
          }
          return next
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    )
    elements.forEach((element) => stepObserver.observe(element))
    connectors.forEach((connector) => connectorObserver.observe(connector))

    let scrollFrame = 0
    const updateConnectorProgress = () => {
      scrollFrame = 0
      const viewportHeight = window.innerHeight
      const startLine = viewportHeight * 0.84
      const endLine = viewportHeight * 0.28

      connectors.forEach((connector) => {
        const bounds = connector.getBoundingClientRect()
        const travel = bounds.height + startLine - endLine
        const progress = Math.min(1, Math.max(0, (startLine - bounds.top) / travel))
        const labelProgress = Math.min(1, Math.max(0, (progress - 0.34) / 0.16))
        const progressPath = connector.querySelector<SVGPathElement>('.process-connector__progress')

        progressPath?.style.setProperty('stroke-dashoffset', String(100 - progress * 100))
        connector.style.setProperty('--connector-label-progress', labelProgress.toFixed(3))
      })
    }
    const requestConnectorUpdate = () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(updateConnectorProgress)
    }

    updateConnectorProgress()
    window.addEventListener('scroll', requestConnectorUpdate, { passive: true })
    window.addEventListener('resize', requestConnectorUpdate)
    return () => {
      stepObserver.disconnect()
      connectorObserver.disconnect()
      window.removeEventListener('scroll', requestConnectorUpdate)
      window.removeEventListener('resize', requestConnectorUpdate)
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
    }
  }, [])

  return (
    <section id="demo" ref={sectionRef} className="process-flow story-section">
      <div className="story-container story-container--narrow">
        <div className="process-flow__heading">
          <span>Restoranınızı</span>
          <h2 className="font-display">Tek akışta yönetin.</h2>
          <p>
            Menü yönetiminden tema ve QR görünümüne, masa operasyonundan raporlar ve
            müşteri sadakatine kadar işletmenizin temel araçları aynı panelde birlikte çalışır.
          </p>
        </div>

        <div className="process-flow__prompt">
          <div>
            <span>Tek merkezden yönetim</span>
            <strong>Menüden rapora tüm operasyon aynı akışta ilerler.</strong>
          </div>
          <i aria-hidden="true" />
          <b><MI.sparkles size={17} /> Masabu devrede</b>
        </div>

        <div className="process-flow__steps">
          {processSteps.map((step, index) => {
            const visible = visibleSteps.has(index)
            const demoUrl = safeDemoUrl(step)
            return (
              <div key={step.number}>
                <article
                  className="process-step"
                  data-process-step={index}
                  data-visible={visible}
                  data-reverse={!demoUrl && index % 2 === 1}
                >
                  <div className="process-step__copy">
                    <div className="process-step__eyebrow"><StoryIcon name={step.icon} /> {step.eyebrow}</div>
                    <h3 className="font-display">{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  {demoUrl ? (
                    <InteractiveProcessPoster
                      step={step}
                      demoUrl={demoUrl}
                      visible={visible}
                    />
                  ) : step.number === '03' ? (
                    <PaymentCartPoster />
                  ) : (
                    <button
                      type="button"
                      className="process-poster"
                      onClick={() => setActivePreview(step)}
                      aria-label={`${step.eyebrow}: ürün ekranını büyüt`}
                    >
                      <span className="process-poster__browser">
                        <i /><i /><i />
                        <small>masabu.co</small>
                      </span>
                      <span className="process-poster__image">
                        <Image src={step.poster} alt={step.posterAlt} fill sizes="(max-width: 760px) 92vw, 520px" />
                      </span>
                      <span className="process-poster__action">
                        <MI.play size={13} /> Posteri büyüt
                      </span>
                    </button>
                  )}
                </article>
                {index < processSteps.length - 1 && step.transitionLabel && (
                  <div
                    className="process-connector"
                    data-process-connector={index}
                    data-visible={visibleConnectors.has(index)}
                    data-reverse={index % 2 === 1}
                  >
                    <svg
                      className="process-connector__path"
                      viewBox="0 0 100 220"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        className="process-connector__track"
                        d="M 50 0 V 26 C 50 39 43 48 31 48 H 12 C 5 48 2 55 2 63 V 91 C 2 102 10 110 21 110 H 79 C 90 110 98 118 98 129 V 145 C 98 157 90 165 79 165 H 63 C 54 165 50 172 50 181 V 220"
                        pathLength="100"
                      />
                      <path
                        className="process-connector__progress"
                        d="M 50 0 V 26 C 50 39 43 48 31 48 H 12 C 5 48 2 55 2 63 V 91 C 2 102 10 110 21 110 H 79 C 90 110 98 118 98 129 V 145 C 98 157 90 165 79 165 H 63 C 54 165 50 172 50 181 V 220"
                        pathLength="100"
                      />
                    </svg>
                    <span>{step.transitionLabel}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {activePreview && (
        <SupademoDialog
          eyebrow={activePreview.eyebrow}
          title="Ürün ekranı"
          poster={activePreview.poster}
          posterAlt={activePreview.posterAlt}
          demoUrl={null}
          onClose={() => setActivePreview(null)}
        />
      )}
    </section>
  )
}
