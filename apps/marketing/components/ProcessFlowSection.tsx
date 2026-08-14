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
        {frameFailed && (
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
  const [activePreview, setActivePreview] = useState<ProcessStep | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const elements = Array.from(section.querySelectorAll<HTMLElement>('[data-process-step]'))
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSteps((previous) => {
          const next = new Set(previous)
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(Number((entry.target as HTMLElement).dataset.processStep))
          }
          return next
        })
      },
      { threshold: 0.3, rootMargin: '0px 0px -12% 0px' },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
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
                        <Image src={step.poster} alt={step.posterAlt} fill priority={index === 0} sizes="(max-width: 760px) 92vw, 520px" />
                      </span>
                      <span className="process-poster__action">
                        <MI.play size={13} /> Posteri büyüt
                      </span>
                    </button>
                  )}
                </article>
                {index < processSteps.length - 1 && step.transitionLabel && (
                  <div className="process-connector" data-visible={visible} data-reverse={index % 2 === 1}>
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
