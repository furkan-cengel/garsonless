'use client'
import { NEW_PASSWORD_MIN_LENGTH, NEW_PASSWORD_REQUIREMENTS } from '../../lib/auth/password-policy'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setPasswordFromRecovery } from '../../lib/actions/auth'
import { AuthField, AuthStatus, useAuthAction } from './auth-form'
import styles from '../../app/auth/login/login.module.css'
export default function ResetPasswordForm({ valid, next }: { valid: boolean; next: string }) {
  const [password, setPassword] = useState('')
  const router = useRouter()
  const action = useAuthAction(async (_previous, data) => {
    const result = await setPasswordFromRecovery({ newPassword: String(data.get('newPassword') ?? '') })
    if ('success' in result) { setPassword(''); router.replace('/auth/login?' + new URLSearchParams({ success: 'password-reset', next }).toString()); router.refresh() }
    return result
  })
  if (!valid) return <div className={styles.form}><header className={styles.formHeading}><h1>Yeni bağlantı gerekli.</h1><p>Şifreni yenilemek için e-postandaki geçerli bağlantıyı aç veya yeni bir bağlantı iste.</p></header><Link className={styles.primaryButton} href={'/auth/login?' + new URLSearchParams({mode: 'forgot', next}).toString()}>Yeni bağlantı iste</Link></div>
  return <form ref={action.ref} onSubmit={action.onSubmit} action={action.dispatch} className={styles.form} aria-busy={action.pending} noValidate>
    <header className={styles.formHeading}><h1>Yeni şifre belirle.</h1><p>{NEW_PASSWORD_REQUIREMENTS} İşlemden sonra yeni şifrenle tekrar giriş yapacaksın.</p></header>
    <AuthField label="Yeni şifre" name="newPassword" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={NEW_PASSWORD_MIN_LENGTH} required error={action.state?.fieldErrors?.newPassword}/>
    <AuthStatus state={action.state}/><button className={styles.primaryButton} disabled={action.pending}>{action.pending ? 'Güncelleniyor…' : 'Şifreyi güncelle'}</button>
    <Link className={styles.backButton} href={'/auth/login?' + new URLSearchParams({next}).toString()}>Girişe dön</Link>
  </form>
}
