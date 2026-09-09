'use client'

import { trackMarketingEvent } from '@garsonless/ui/analytics-client'

import Script from 'next/script'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select'

type FormState = { kind: 'idle' | 'success' | 'error'; message: string }
type ContactTopic = 'general' | 'sales' | 'support'

const TOPIC_LABELS: Record<ContactTopic, string> = {
  general: 'Genel bilgi',
  sales: 'Ürün ve fiyatlandırma',
  support: 'Teknik destek',
}

type RecaptchaApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    theme: 'light'
    size: 'normal' | 'compact'
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
  }) => number
  reset: (widgetId?: number) => void
}

declare global {
  interface Window {
    grecaptcha?: RecaptchaApi
  }
}

const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
const recaptchaSiteKey = process.env.NODE_ENV === 'development'
  ? RECAPTCHA_TEST_SITE_KEY
  : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || ''

function Field({ label, name, type = 'text', placeholder, required = true, autoComplete }: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <label className="contact-form__field">
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
    </label>
  )
}

function RecaptchaCheckbox({ onTokenChange, resetSignal }: {
  onTokenChange: (token: string) => void
  resetSignal: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<number | null>(null)
  const onTokenChangeRef = useRef(onTokenChange)
  const [scriptReady, setScriptReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  onTokenChangeRef.current = onTokenChange

  useEffect(() => {
    if (typeof window.grecaptcha?.render === 'function') setScriptReady(true)
  }, [])

  useEffect(() => {
    if (!scriptReady || !recaptchaSiteKey || !hostRef.current || widgetRef.current !== null) return
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const renderWidget = () => {
      if (!hostRef.current || widgetRef.current !== null) return
      if (typeof window.grecaptcha?.render !== 'function') {
        attempts += 1
        if (attempts >= 50) {
          setLoadFailed(true)
          return
        }
        timer = setTimeout(renderWidget, 100)
        return
      }
      widgetRef.current = window.grecaptcha.render(hostRef.current, {
        sitekey: recaptchaSiteKey,
        theme: 'light',
        size: window.matchMedia('(max-width: 370px)').matches ? 'compact' : 'normal',
        callback: (token) => onTokenChangeRef.current(token),
        'expired-callback': () => onTokenChangeRef.current(''),
        'error-callback': () => {
          onTokenChangeRef.current('')
          setLoadFailed(true)
        },
      })
    }

    renderWidget()
    return () => { if (timer) clearTimeout(timer) }
  }, [scriptReady])

  useEffect(() => {
    if (resetSignal > 0 && widgetRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetRef.current)
      onTokenChangeRef.current('')
    }
  }, [resetSignal])

  if (!recaptchaSiteKey) {
    return <p className="contact-form__captcha-error" role="alert">Güvenlik doğrulaması yapılandırılmadığı için form şu an kullanılamıyor.</p>
  }

  return (
    <div className="contact-form__captcha">
      <Script
        id="masabu-recaptcha-v2"
        src="https://www.google.com/recaptcha/api.js?render=explicit&hl=tr"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setLoadFailed(true)}
      />
      <span className="contact-form__captcha-label">Güvenlik doğrulaması *</span>
      <div ref={hostRef} />
      {loadFailed && <p className="contact-form__captcha-error" role="alert">Doğrulama yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.</p>}
    </div>
  )
}

export function BusinessContactForm() {
  const [topic, setTopic] = useState<ContactTopic>('general')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)
  const [state, setState] = useState<FormState>({ kind: 'idle', message: '' })
  const [pending, startTransition] = useTransition()
  const isSales = topic === 'sales'

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('subject') === 'business') setTopic('sales')
  }, [])

  function resetCaptcha() {
    setCaptchaToken('')
    setCaptchaResetSignal((value) => value + 1)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!captchaToken) {
      setState({ kind: 'error', message: 'Lütfen güvenlik doğrulamasını tamamlayın.' })
      return
    }
    const body = { ...Object.fromEntries(new FormData(form).entries()), topic, recaptchaToken: captchaToken }
    setState({ kind: 'idle', message: '' })
    startTransition(async () => {
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => null) as { message?: unknown; leadAccepted?: boolean } | null
        if (!response.ok) {
          resetCaptcha()
          setState({ kind: 'error', message: typeof payload?.message === 'string' ? payload.message : 'Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.' })
          return
        }
        if (payload?.leadAccepted === true && topic !== 'support') trackMarketingEvent({ name: 'generate_lead', topic })
        form.reset()
        setTopic('general')
        resetCaptcha()
        setState({ kind: 'success', message: 'Mesajınız alındı. En kısa sürede sizinle iletişime geçeceğiz.' })
      } catch {
        resetCaptcha()
        setState({ kind: 'error', message: 'Bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.' })
      }
    })
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate={false}>
      <div className="contact-form__heading">
        <p>Bize yazın</p>
        <h2 className="font-display">İhtiyacınızı kısaca anlatın.</h2>
      </div>

      <div className="contact-form__fields">
        <Field label="Ad soyad" name="name" placeholder="Adınız ve soyadınız" autoComplete="name" />
        <Field label="E-posta" name="email" type="email" placeholder="ornek@isletme.com" autoComplete="email" />
        <div className="contact-form__field">
          <span id="contact-topic-label">Konu *</span>
          <Select name="topic" value={topic} onValueChange={(value) => setTopic(value as ContactTopic)}>
            <SelectTrigger aria-labelledby="contact-topic-label">
              <SelectValue>{TOPIC_LABELS[topic]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Genel bilgi</SelectItem>
              <SelectItem value="sales">Ürün ve fiyatlandırma</SelectItem>
              <SelectItem value="support">Teknik destek</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field label="İşletme adı" name="businessName" placeholder="İşletmenizin adı" required={isSales} autoComplete="organization" />
        {isSales && (
          <div className="contact-form__split">
            <Field label="Telefon" name="phone" type="tel" placeholder="+90 555 000 00 00" autoComplete="tel" />
            <Field label="Şube sayısı" name="branchCount" type="number" placeholder="1" />
          </div>
        )}
        <label className="contact-form__field">
          <span>Mesajınız *</span>
          <textarea name="message" required rows={6} maxLength={2000} placeholder="Size nasıl yardımcı olabileceğimizi anlatın." />
        </label>
        <label className="contact-form__honeypot" aria-hidden="true">
          Website<input name="website" tabIndex={-1} autoComplete="off" />
        </label>

        <RecaptchaCheckbox onTokenChange={setCaptchaToken} resetSignal={captchaResetSignal} />

        <p className="contact-form__privacy">
          Bilgileriniz yalnız talebinizi yanıtlamak için işlenir; bu form pazarlama izni istemez.{' '}
          <a href="/yasal/kvkk-aydinlatma-metni" target="_blank" rel="noreferrer">KVKK Aydınlatma Metni</a>
          {' '}ve Google reCAPTCHA hizmetinin gizlilik koşulları geçerlidir.
        </p>
        <button className="contact-form__submit" type="submit" disabled={pending || !recaptchaSiteKey}>
          {pending ? 'Gönderiliyor…' : 'Mesajı gönder'}
        </button>
        <div className="contact-form__status" aria-live="polite">
          {state.message && <p role={state.kind === 'error' ? 'alert' : 'status'} data-kind={state.kind}>{state.message}</p>}
        </div>
      </div>
    </form>
  )
}
