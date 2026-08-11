'use client'

import Image from 'next/image'
import { AppIcons as I } from '@garsonless/ui/icons'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

type HeroFlowStep = {
  id: 'scan' | 'route' | 'kitchen' | 'settle'
  label: string
  revealAt: number
}

const ORDER = {
  table: 'Masa 5',
  venue: 'MAF Cafe Lounge',
  total: '₺830',
  count: 5,
  items: ['Serpme Kahvaltı', '2× Türk Kahvesi', 'Avokado Toast', 'Portakal suyu'],
} as const

const STEPS = [
  { id: 'scan', label: 'Masa 5 · QR', revealAt: 1 },
  { id: 'route', label: 'Sipariş · Tek akış', revealAt: 3 },
  { id: 'kitchen', label: 'Mutfak · Canlı', revealAt: 7 },
  { id: 'settle', label: 'Ödeme · Sadakat', revealAt: 9 },
] as const satisfies readonly HeroFlowStep[]

const TIMELINE = [
  { at: 0, frame: 0 },
  { at: 260, frame: 1 },
  { at: 1220, frame: 2 },
  { at: 2050, frame: 3 },
  { at: 2420, frame: 4 },
  { at: 2760, frame: 5 },
  { at: 3100, frame: 6 },
  { at: 3820, frame: 7 },
  { at: 5100, frame: 8 },
  { at: 5980, frame: 9 },
  { at: 6800, frame: 10 },
] as const

const CYCLE_MS = 8800
const STEP_MS = CYCLE_MS / STEPS.length

function frameForElapsed(elapsed: number) {
  let current = 0
  for (const item of TIMELINE) {
    if (elapsed < item.at) break
    current = item.frame
  }
  return current
}

function activeStepForElapsed(elapsed: number) {
  return Math.min(STEPS.length - 1, Math.floor(elapsed / STEP_MS))
}

function StepTag({
  step,
  active,
  visible,
}: {
  step: HeroFlowStep
  active: boolean
  visible: boolean
}) {
  return (
    <span
      className="hero-flow__tag"
      data-active={active}
      data-visible={visible}
      aria-current={active ? 'step' : undefined}
    >
      <I.sparkles size={13} />
      {step.label}
    </span>
  )
}

export function HeroFlow() {
  const rootRef = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const [frame, setFrame] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  const paused = !visible || !documentVisible

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setReducedMotion(media.matches)
      if (media.matches) {
        setFrame(10)
        setActiveStep(STEPS.length - 1)
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.15 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setDocumentVisible(document.visibilityState === 'visible')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  useEffect(() => {
    if (reducedMotion || paused) {
      lastTimeRef.current = null
      return
    }

    let animationFrame = 0
    const tick = (now: number) => {
      const previous = lastTimeRef.current
      lastTimeRef.current = now
      if (previous !== null) {
        elapsedRef.current = (elapsedRef.current + Math.min(now - previous, 80)) % CYCLE_MS
        const nextFrame = frameForElapsed(elapsedRef.current)
        const nextStep = activeStepForElapsed(elapsedRef.current)
        setFrame((current) => current === nextFrame ? current : nextFrame)
        setActiveStep((current) => current === nextStep ? current : nextStep)
      }
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      lastTimeRef.current = null
    }
  }, [paused, reducedMotion])

  const completedChecks = Math.max(0, Math.min(3, frame - 3))
  const progress = useMemo(() => {
    if (reducedMotion) return 100
    return [18, 48, 74, 100][activeStep] ?? 18
  }, [activeStep, reducedMotion])

  return (
    <div
      ref={rootRef}
      className="hero-flow"
      data-frame={frame}
      style={{ '--hero-line-shift': `${-165 - activeStep * 64}px` } as CSSProperties}
    >
      <div className="hero-flow__line" aria-hidden="true">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path className="hero-flow__line-track" d="M-40 20 H300 a22 22 0 0 1 22 22 V54 a22 22 0 0 0 22 22 H1240" />
          <path
            className="hero-flow__line-progress"
            d="M-40 20 H300 a22 22 0 0 1 22 22 V54 a22 22 0 0 0 22 22 H1240"
            pathLength="100"
            style={{ strokeDashoffset: 100 - progress }}
          />
        </svg>
      </div>

      <div className="hero-flow__nodes">
        <article className="hero-flow__node hero-flow__node--scan" data-visible={frame >= STEPS[0].revealAt} data-active={activeStep === 0} data-position={activeStep === 0 ? 'active' : 'previous'}>
          <StepTag step={STEPS[0]} active={activeStep === 0} visible={frame >= STEPS[0].revealAt} />
          <div className="hero-flow__card hero-flow__order-card">
            <div className="hero-flow__identity">
              <span className="hero-flow__brand-mark"><I.scan size={14} /></span>
              <span>{ORDER.venue} · misafir siparişi</span>
            </div>
            <p>Serpme kahvaltı, 2 Türk kahvesi ve 1 avokado toast.</p>
            <div className="hero-flow__suggestion" data-added={frame >= 2}>
              <span><I.glassWater size={14} /> Yanına portakal suyu</span>
              <span className="hero-flow__suggestion-action">
                {frame >= 2 ? <I.check size={13} /> : <I.plus size={13} />}
              </span>
            </div>
          </div>
        </article>

        <article className="hero-flow__node hero-flow__node--route" data-visible={frame >= STEPS[1].revealAt} data-active={activeStep === 1} data-position={activeStep === 1 ? 'active' : activeStep === 0 ? 'next' : 'previous'}>
          <StepTag step={STEPS[1]} active={activeStep === 1} visible={frame >= STEPS[1].revealAt} />
          <div className="hero-flow__card hero-flow__checklist">
            {['Sipariş alındı', 'Mutfak / bara yönlendirildi', 'Adisyon güncellendi'].map((label, index) => (
              <div className="hero-flow__check" data-done={reducedMotion || completedChecks > index} key={label}>
                <span>{reducedMotion || completedChecks > index ? <I.check size={12} /> : index + 1}</span>
                {label}
              </div>
            ))}
          </div>
        </article>

        <article className="hero-flow__node hero-flow__node--kitchen" data-visible={frame >= STEPS[2].revealAt} data-active={activeStep === 2} data-position={activeStep === 2 ? 'active' : activeStep === 1 ? 'next' : activeStep > 2 ? 'previous' : 'hidden'}>
          <StepTag step={STEPS[2]} active={activeStep === 2} visible={frame >= STEPS[2].revealAt} />
          <div className="hero-flow__card hero-flow__kds-card" data-ready={frame >= 8}>
            <div className="hero-flow__kds-head">
              <div>
                <span className="hero-flow__kds-status">{frame >= 8 ? 'Hazır' : 'Hazırlanıyor'}</span>
                <strong>{ORDER.table}</strong>
              </div>
              <span className="font-mono">{frame >= 8 ? '06:12' : '04:18'}</span>
            </div>
            <div className="hero-flow__station"><I.cutlery size={14} /><span>Serpme Kahvaltı</span><small>Mutfak</small></div>
            <div className="hero-flow__station"><I.glassWater size={14} /><span>2× Türk Kahvesi</span><small>Bar</small></div>
            <div className="hero-flow__kds-progress"><span /></div>
          </div>
        </article>

        <article className="hero-flow__node hero-flow__node--settle" data-visible={frame >= STEPS[3].revealAt} data-active={activeStep === 3} data-position={activeStep === 3 ? 'active' : activeStep === 2 ? 'next' : 'hidden'}>
          <StepTag step={STEPS[3]} active={activeStep === 3} visible={frame >= STEPS[3].revealAt} />
          <div className="hero-flow__card hero-flow__receipt-card">
            <div className="hero-flow__receipt-image">
              <Image
                src="/hero/turkish-breakfast-order.webp"
                alt="Serpme kahvaltı, Türk kahvesi, avokado toast ve portakal suyu"
                fill
                priority
                sizes="(max-width: 700px) 88vw, (max-width: 1000px) 45vw, 29vw"
              />
              <span className="hero-flow__receipt-state"><span /> {ORDER.table} · Tamamlandı</span>
            </div>
            <div className="hero-flow__receipt-body">
              <h2 className="font-display">Serpme kahvaltı</h2>
              <p>{ORDER.count} ürün · 2 Türk kahvesi · avokado toast</p>
              <div className="hero-flow__receipt-foot">
                <div>
                  <span className="hero-flow__paid"><I.check size={12} /> İyzico · Ödeme alındı</span>
                  <span className="hero-flow__stamp" data-visible={frame >= 10}><I.stamp size={12} /> +1 damga</span>
                </div>
                <strong className="font-mono">{ORDER.total}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="hero-flow__mobile-tabs" aria-label="Sipariş akışı adımları">
        {STEPS.map((step, index) => (
          <span
            key={step.id}
            className="hero-flow__mobile-step"
            aria-current={activeStep === index ? 'step' : undefined}
          >
            <I.sparkles aria-hidden="true" size={13} />
            <span>{step.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
