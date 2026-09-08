'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { BillableFeature } from '@garsonless/domain/entitlements'
import styles from '../PlanLockedPanel.module.css'

export default function PlanLockVisual({ feature, label }: { feature: BillableFeature; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<{ feature: BillableFeature; Component: ComponentType<{ feature: BillableFeature }> } | null>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    let active = true
    let requested = false
    const media = window.matchMedia('(min-width: 761px)')
    const update = () => {
      const width = host.current?.getBoundingClientRect().width ?? 0
      if (!media.matches || width === 0) return
      setScale(Math.min(0.68, (width - 40) / 680))
      if (requested) return
      requested = true
      const load = feature === 'analytics_basic' || feature === 'analytics_advanced'
        ? import('./ReportPreview').then(module => module.default)
        : import('./FeaturePreview').then(module => module.default)
      void load.then(Component => { if (active) setView({ feature, Component }) }).catch(() => { requested = false })
    }
    const observer = new ResizeObserver(update)
    if (host.current) observer.observe(host.current)
    media.addEventListener('change', update)
    update()
    return () => { active = false; observer.disconnect(); media.removeEventListener('change', update) }
  }, [feature])
  const Preview = view?.feature === feature ? view.Component : null
  return <aside ref={host} className={styles.visual} data-plan-lock-visual aria-label={`${label} önizlemesi`}>
    {Preview && <div className={styles.screenFrame} style={{ width: 680 * scale, height: 650 * scale }}>
      <div className={styles.screen} style={{ transform: `scale(${scale})` }} inert aria-hidden="true"><Preview feature={feature} /></div>
    </div>}
    <p className={styles.visualCaption}>{label} · Örnek görünüm</p>
  </aside>
}
