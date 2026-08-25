'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { resendSignupEmailCode, verifySignupEmailCode } from '../../lib/actions/auth'
import { I } from '../../lib/ui'
import authStyles from '../../app/auth/login/login.module.css'
import styles from './VerifyEmailForm.module.css'

interface Props {
  email: string
  next: string
}

export default function VerifyEmailForm({ email, next }: Props) {
  const [verifyState, verifyAction, verifying] = useActionState(verifySignupEmailCode, null)
  const [resendState, resendAction, resending] = useActionState(resendSignupEmailCode, null)
  const verifyError = verifyState && 'error' in verifyState ? verifyState.error : ''
  const resendError = resendState && 'error' in resendState ? resendState.error : ''
  const resent = Boolean(resendState && 'success' in resendState)

  return (
    <div className={`${authStyles.form} ${styles.form}`}>
      <span className={authStyles.successIcon}><I.mail size={22} /></span>
      <header className={authStyles.formHeading}>
        <h1>E-postanı doğrula<span className={authStyles.period}>.</span></h1>
        <p>İşletme kurulumuna geçmek için e-postana gönderdiğimiz 6 haneli kodu gir.</p>
      </header>

      <div className={authStyles.successPanel} role="status">
        <div><strong>Kod gönderildi</strong><p>{email}</p></div>
      </div>

      <form action={verifyAction} className={styles.verifyForm}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label className={authStyles.field}>
          <span className={authStyles.fieldLabel}>Doğrulama kodu</span>
          <span className={authStyles.inputShell}>
            <span className={authStyles.inputIcon} aria-hidden="true"><I.lock size={18} /></span>
            <input
              className={`${authStyles.input} ${styles.codeInput}`}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              autoFocus
              required
            />
          </span>
        </label>
        {verifyError ? <div className={authStyles.formError} role="alert"><I.warn size={15} /><span>{verifyError}</span></div> : null}
        <button type="submit" className={authStyles.primaryButton} disabled={verifying}>
          {verifying ? 'Doğrulanıyor…' : <>Doğrula ve devam et <I.chevRight size={16} /></>}
        </button>
      </form>

      <form action={resendAction} className={styles.resendRow}>
        <input type="hidden" name="email" value={email} />
        <span>{resent ? 'Yeni kod gönderildi.' : 'Kod gelmedi mi?'}</span>
        <button type="submit" disabled={resending}>{resending ? 'Gönderiliyor…' : 'Kodu yeniden gönder'}</button>
      </form>
      {resendError ? <div className={authStyles.formError} role="alert"><I.warn size={15} /><span>{resendError}</span></div> : null}

      <Link className={styles.changeEmail} href="/auth/signup">E-posta adresini değiştir</Link>
    </div>
  )
}
