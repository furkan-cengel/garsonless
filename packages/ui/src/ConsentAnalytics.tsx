'use client'

import { useEffect, useState } from 'react'
import { analyticsPath, validMeasurementId, type AnalyticsConsent } from '@garsonless/domain/marketing-analytics'
import { analyticsConsent, consumeSignupReceipt, setAnalyticsConsent, stopAnalytics, syncAnalytics, trackMarketingEvent } from './analytics-client'
import styles from './consent-analytics.module.css'

export function ConsentAnalytics({ measurementId, pathname, surface }: {
  measurementId: string | undefined; pathname: string; surface: 'marketing' | 'dashboard'
}) {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
  const [preferences, setPreferences] = useState(false)
  const id = validMeasurementId(measurementId)
  const allowed = analyticsPath(pathname, surface) !== null

  useEffect(() => {
    const sync = () => {
      const state = analyticsConsent()
      setConsent(state)
      if (id && allowed) syncAnalytics(id, surface)
      else stopAnalytics()
      // Always discard a receipt when measurement is unavailable/denied.
      consumeSignupReceipt()
    }
    sync()
    window.addEventListener('masabu:analytics-consent', sync)
    window.addEventListener('focus', sync)
    const timer = window.setInterval(() => {
      if (analyticsConsent() !== consent) sync()
    }, 1500)
    return () => {
      window.removeEventListener('masabu:analytics-consent', sync)
      window.removeEventListener('focus', sync)
      window.clearInterval(timer)
    }
  }, [id, pathname, surface, allowed, consent])

  useEffect(() => {
    if (!id || !allowed || surface !== 'marketing') return
    const clicked = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest('a') : null
      if (!element) return
      const target = new URL(element.href, location.origin)
      if (target.pathname !== '/auth/signup') return
      trackMarketingEvent({ name: 'signup_click', placement: element.closest('footer') ? 'footer' : element.closest('nav') ? 'header' : 'content' })
    }
    document.addEventListener('click', clicked)
    return () => document.removeEventListener('click', clicked)
  }, [id, allowed, surface])

  if (!id || !allowed || consent === null) return null
  const choose = (value: 'granted' | 'denied') => {
    setAnalyticsConsent(value); setPreferences(false)
    // Unload Google code after withdrawal; consent stays shared across apps.
    if (value === 'denied' && consent === 'granted') window.location.reload()
  }
  return <aside className={styles.scope} aria-label="Analitik tercihleri">
    {consent === 'unknown' || preferences ? <section className={styles.panel} aria-labelledby="analytics-title">
      <h2 id="analytics-title">Analitik tercihiniz</h2>
      <p>İzninizle ziyaret ve kayıt adımlarını Google Analytics ile ölçerek masabu’yu iyileştiriyoruz. Reddetseniz de tüm özellikleri kullanabilirsiniz.</p>
      {preferences && <p>Zorunlu oturum kayıtları hizmetin çalışması için kullanılır. İsteğe bağlı analitik kapalı başlar; reklam ve kişiselleştirme etkin değildir. Tercihiniz 180 gün saklanır.</p>}
      <a href="https://masabu.co/yasal/cerez-politikasi">Çerez politikası</a>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose('granted')}>Kabul et</button>
        <button type="button" onClick={() => choose('denied')}>Reddet</button>
        <button type="button" aria-expanded={preferences} onClick={() => setPreferences(!preferences)}>Tercihler</button>
      </div>
    </section> : <button type="button" className={styles.reopen} onClick={() => setPreferences(true)}>Çerez tercihleri</button>}
  </aside>
}
