'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createPlatformAdminBrowserClient } from '../../../lib/supabase-browser'

type Factor = { id: string; qr: string | null }

export function MfaChallenge() {
  const started = useRef(false)
  const [factor, setFactor] = useState<Factor | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      const supabase = createPlatformAdminBrowserClient()
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) { setError('MFA bilgisi alınamadı.'); setBusy(false); return }
      const totpFactors = data.all.filter((item) => item.factor_type === 'totp')
      const verified = totpFactors.find((item) => item.status === 'verified')
      if (verified) { setFactor({ id: verified.id, qr: null }); setBusy(false); return }
      for (const pending of totpFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pending.id })
        if (unenrollError) {
          setError('Yarım kalan Authenticator kurulumu sıfırlanamadı. Sayfayı yenileyip tekrar deneyin.')
          setBusy(false)
          return
        }
      }
      const { data: enrollment, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Masabu Platform',
      })
      if (enrollError) { setError('Authenticator kurulumu başlatılamadı.'); setBusy(false); return }
      setFactor({ id: enrollment.id, qr: enrollment.totp.qr_code.trimEnd() })
      setBusy(false)
    })()
  }, [])

  async function verify() {
    if (!factor || code.length !== 6) return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await createPlatformAdminBrowserClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (verifyError) { setError('Kod doğrulanamadı. Yeni kodu deneyin.'); setBusy(false); return }
    window.location.assign('/')
  }

  const instruction = busy && !factor
    ? 'Güvenli Authenticator kurulumu hazırlanıyor.'
    : factor?.qr
      ? 'QR kodunu authenticator uygulamanla tara ve oluşan 6 haneli kodu gir.'
      : 'Authenticator uygulamandaki 6 haneli güncel kodu gir.'

  return (
    <section className="auth-card" aria-busy={busy}>
      <p className="eyebrow">Zorunlu ikinci adım</p>
      <h1>Authenticator kodunu doğrula</h1>
      <p>{instruction}</p>
      {factor?.qr ? (
        <Image className="qr" src={factor.qr} width={200} height={200} unoptimized alt="Authenticator kurulum QR kodu" />
      ) : null}
      <label className="field">
        6 haneli kod
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={busy || !factor}
        />
      </label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button primary form-button" type="button" onClick={verify} disabled={busy || !factor || code.length !== 6}>
        {busy ? 'Hazırlanıyor…' : 'Doğrula ve devam et'}
      </button>
    </section>
  )
}
