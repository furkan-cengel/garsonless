'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { resendSignupEmailCode, verifySignupEmailCode, verifyEmailToken, retryAuthCompletion } from '../../lib/actions/auth'
import { readEntryContext, authEntryHref } from '../../lib/auth/entry-context'
import { AuthField, AuthStatus, useAuthAction, useResendCountdown } from './auth-form'
import styles from '../../app/auth/login/login.module.css'
export default function VerifyEmailForm({ email, next, flow = 'signup', compact = false, sent = false, pendingCompletion = false, initialCooldown, onBusyChange, externalBusy = false }: { email: string; next: string; flow?: 'signup' | 'magiclink' | 'recovery'; compact?: boolean; sent?: boolean; pendingCompletion?: boolean; initialCooldown?: number; onBusyChange?: (busy: boolean) => void; externalBusy?: boolean }) {
  const [code, setCode] = useState('')
  const verify = useAuthAction(flow === 'signup' ? verifySignupEmailCode : verifyEmailToken)
  const resend = useAuthAction(resendSignupEmailCode)
  const retry = useAuthAction(retryAuthCompletion)
  const remaining = useResendCountdown(resend.state, initialCooldown ?? (sent ? 60 : 0))
  const ownBusy = verify.pending || resend.pending || retry.pending
  const busy = ownBusy || externalBusy
  useEffect(() => { onBusyChange?.(ownBusy); return () => onBusyChange?.(false) }, [ownBusy, onBusyChange])
  const completion = pendingCompletion || verify.state?.code === 'COMPLETE_PENDING' || retry.state?.code === 'COMPLETE_PENDING'
  return <div className={styles.form}>
    {!compact && <header className={styles.formHeading}><h1>E-postanı doğrula<span className={styles.period}>.</span></h1><p>E-postandaki 6 haneli kodu girerek işletme kurulumuna devam et.</p></header>}
    {!compact && <div className={styles.successPanel} role="status"><p>{sent || resend.state?.success ? 'Doğrulama e-postası gönderildi.' : 'E-postandaki doğrulama kodunu kullanabilir veya yeni kod isteyebilirsin.'}<br/>{email}</p></div>}
    <form ref={completion ? retry.ref : verify.ref} onSubmit={completion ? retry.onSubmit : verify.onSubmit} action={completion ? retry.dispatch : verify.dispatch} aria-busy={busy} className={styles.form} noValidate>
      <input type="hidden" name="email" value={email}/><input type="hidden" name="next" value={next}/><input type="hidden" name="flow" value={flow}/>
      {!completion && <AuthField name="code" label={compact ? 'E-postadaki kodla devam et' : 'Doğrulama kodu'} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} required error={verify.state?.fieldErrors?.code}/>}
      <AuthStatus state={verify.state}/><AuthStatus state={retry.state}/>
      <button className={styles.primaryButton} disabled={busy}>{busy ? 'Doğrulanıyor…' : completion ? 'Oturumu tamamla' : 'Doğrula ve devam et'}</button>
    </form>
    {flow === 'signup' && !completion && <form ref={resend.ref} onSubmit={resend.onSubmit} action={resend.dispatch} className={styles.resendForm}>
      <input type="hidden" name="email" value={email}/><input type="hidden" name="next" value={next}/>
      <button className={styles.backButton} disabled={busy || remaining > 0}>{remaining > 0 ? 'Yeniden gönder (' + remaining + ' sn)' : 'Kodu yeniden gönder'}</button><AuthStatus state={resend.state}/>
    </form>}
    {!compact && <Link className={styles.backButton} href={authEntryHref('/auth/signup', readEntryContext({next}, true), email)}>E-posta adresini değiştir</Link>}
  </div>
}
