'use client'

import { useEffect, useRef, useState } from 'react'
import { analyticsPath, validMeasurementId, type AnalyticsConsent } from '@garsonless/domain/marketing-analytics'
import { analyticsConsent, consumeSignupReceipt, setAnalyticsConsent, stopAnalytics, syncAnalytics, trackMarketingEvent } from './analytics-client'
import styles from './consent-analytics.module.css'

export function CookiePreferencesButton() {
  return <button type="button" className={styles.footerButton} onClick={() => window.dispatchEvent(new Event('masabu:open-cookie-preferences'))}>Çerez yönetimi</button>
}

export function ConsentAnalytics({ measurementId, pathname, surface }: {
  measurementId: string | undefined; pathname: string; surface: 'marketing' | 'dashboard'
}) {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
  const [preferences, setPreferences] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const reopen = useRef<HTMLButtonElement>(null)
  const id = validMeasurementId(measurementId)
  const allowed = analyticsPath(pathname, surface) !== null

  const closePreferences = () => {
    setPreferences(false)
    requestAnimationFrame(() => {
      (opener.current?.isConnected ? opener.current : reopen.current)?.focus()
    })
  }

  useEffect(() => {
    const open = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPreferences(true)
    }
    window.addEventListener('masabu:open-cookie-preferences', open)
    return () => window.removeEventListener('masabu:open-cookie-preferences', open)
  }, [])

  useEffect(() => {
    if (preferences) panel.current?.focus()
  }, [preferences])

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
      const placement = element.closest('footer') ? 'footer' : element.closest('nav') ? 'header' : 'content'
      const signup = target.pathname === '/auth/signup'
      const demo = element.dataset.conversionEvent === 'demo_request_click'
      if (signup) {
        trackMarketingEvent({ name: 'signup_click', placement })
        trackMarketingEvent({ name: 'free_trial_click', placement })
      }
      if (demo) trackMarketingEvent({ name: 'demo_request_click', placement })
      if (signup || demo) {
        if (element.dataset.conversionContext === 'pricing' || location.pathname === '/fiyatlar') {
          trackMarketingEvent({ name: 'pricing_cta_click', placement })
        }
        if (location.pathname === '/menu-alerjen-zorunlulugu') {
          trackMarketingEvent({ name: 'allergen_landing_cta_click', placement })
        }
      }
      if (target.protocol === 'tel:') trackMarketingEvent({ name: 'phone_click', placement })
      if (['https:', 'http:'].includes(target.protocol) && ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(target.hostname)) {
        trackMarketingEvent({ name: 'whatsapp_click', placement })
      }
    }
    document.addEventListener('click', clicked)
    return () => document.removeEventListener('click', clicked)
  }, [id, allowed, surface])

  // Preferences remain available from account settings even on unmeasured pages.
  // Only measured routes show an automatic first-visit notice.
  if (consent === null || (!allowed && !preferences)) return null
  const choose = (value: 'granted' | 'denied') => {
    // Acknowledging today's essential use never grants future analytics permission.
    const selection = !id && value === 'granted' ? 'essential' : value
    setAnalyticsConsent(selection); closePreferences()
    // Unload Google code after withdrawal; consent stays shared across apps.
    if (selection !== 'granted' && consent === 'granted') window.location.reload()
  }
  return <aside className={styles.scope} aria-label="Çerez tercihleri">
    {consent === 'unknown' || (id && consent === 'essential') || preferences ? <section ref={panel} tabIndex={-1} className={`${styles.panel} ${preferences ? styles.details : ''}`} aria-labelledby="analytics-title" onKeyDown={(event) => {
      if (event.key === 'Escape' && preferences) { event.preventDefault(); closePreferences() }
    }}>
      <h2 id="analytics-title" className={preferences ? undefined : styles.visuallyHidden}>Çerez tercihleri</h2>
      {surface === 'marketing' && !preferences ? <>
        <p>{id ? 'Zorunlu çerezler kullanıyoruz. İzninizle Google Analytics üzerinden ziyaret ve kayıt adımlarını ölçüyoruz. Reddetmek site kullanımını etkilemez.' : 'Zorunlu çerezler kullanıyoruz. Analitik şu anda kapalıdır. Kabul et seçiminiz gelecekte analitiği otomatik olarak açmaz.'}</p>
        <p><a href="https://masabu.co/yasal/cerez-politikasi">Çerez Politikası</a></p>
      </> : <>
      <p>Sitemizin çalışması için zorunlu çerezler kullanıyoruz. {id ? 'İzninizle ziyaret ve kayıt adımlarını Google Analytics ile ölçerek masabu’yu iyileştiriyoruz. İsteğe bağlı analitik çerezlerini reddetseniz de tüm özellikleri kullanabilirsiniz.' : 'Analitik ve reklam çerezleri şu anda kapalıdır. “Kabul et” seçiminiz yalnızca mevcut zorunlu kullanımı onaylar; gelecekte analitiği otomatik olarak açmaz.'}</p>
      <p>Çerez kullanımımızı <a href="https://masabu.co/yasal/cerez-politikasi">Çerez Politikası</a> üzerinden inceleyebilir, seçiminizi istediğiniz zaman “Çerez yönetimi” bölümünden değiştirebilirsiniz.</p>
      </>}
      {preferences && <>
        <div className={styles.category}><strong>Zorunlu kayıtlar</strong><span>Her zaman etkin</span><p>Güvenli giriş, oturum ve talep ettiğiniz temel işlevler için kullanılır.</p></div>
        <div className={styles.category}><strong>Analitik</strong><span>{!id ? 'Kullanımda değil' : consent === 'granted' ? 'İzin verildi' : 'Kapalı'}</span><p>Google Analytics, yalnızca kabulünüzden sonra ziyaret ve kayıt adımlarını ölçer. Tercihiniz 180 gün saklanır. Reklam ve kişiselleştirme etkin değildir.</p></div>
        <p>Supademo demoları ve iletişim formundaki reCAPTCHA kendi teknik kayıtlarını kullanabilir. Bu panel yalnızca Masabu’nun Google Analytics tercihini yönetir; ayrıntılar çerez politikasındadır.</p>
      </>}
      <div className={styles.actions}>
        {!preferences ? <button ref={reopen} type="button" aria-expanded={false} onClick={(event) => { opener.current = event.currentTarget; setPreferences(true) }}>Tercihler</button>
          : <button type="button" onClick={closePreferences}>Geri</button>}
        <button className={styles.primary} type="button" onClick={() => choose('denied')}>Reddet</button>
        <button className={styles.primary} type="button" onClick={() => choose('granted')}>Kabul et</button>
      </div>
    </section> : null}
  </aside>
}
