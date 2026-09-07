'use client'
import { NEW_PASSWORD_MIN_LENGTH, NEW_PASSWORD_REQUIREMENTS } from '../../lib/auth/password-policy'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { signIn, signUp, sendMagicLink, requestPasswordReset } from '../../lib/actions/auth'
import { authEntryHref, type AuthEntryContext } from '../../lib/auth/entry-context'
import { AuthField, AuthStatus, useAuthAction, useResendCountdown } from './auth-form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import VerifyEmailForm from './VerifyEmailForm'
import GoogleSignIn from './GoogleSignIn'
import styles from '../../app/auth/login/login.module.css'

export default function AuthEntry({ signup = false, context, initialEmail = '', message, messageKind = 'error', initialMode = 'password' }: { signup?: boolean; context: AuthEntryContext; initialEmail?: string; message?: string; messageKind?: 'error' | 'success'; initialMode?: 'password' | 'email' | 'forgot' }) {
  const [email, setEmail] = useState(initialEmail)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [mode, setMode] = useState(initialMode)
  const [sentTo, setSentTo] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  const login = useAuthAction(signIn)
  const register = useAuthAction(signUp)
  const magic = useAuthAction(sendMagicLink)
  const recovery = useAuthAction(requestPasswordReset)
  const action = signup ? register : mode === 'password' ? login : mode === 'email' ? magic : recovery
  const remaining = useResendCountdown(action.state)
  const marketing = process.env['NEXT_PUBLIC_MARKETING_URL'] ?? 'https://masabu.co'
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('masabu-auth-draft') ?? 'null')
      if (saved && saved.expiresAt > Date.now()) { if (!initialEmail) setEmail(saved.email ?? ''); setName(saved.name ?? '') }
    } catch { /* Storage is optional. */ }
    setRestored(true)
  }, [initialEmail])
  useEffect(() => {
    if (!restored) return
    try { sessionStorage.setItem('masabu-auth-draft', JSON.stringify({ email, name, expiresAt: Date.now() + 600_000 })) } catch { /* Storage is optional. */ }
  }, [email, name, restored])
  function changeMode(nextMode: string) {
    setMode(nextMode as 'password' | 'email' | 'forgot')
    setShowCode(false)
    setPassword('')
    const url = new URL(window.location.href)
    if (nextMode === 'password') url.searchParams.delete('mode')
    else url.searchParams.set('mode', nextMode)
    window.history.pushState(null, '', url)
  }
  useEffect(() => {
    const restoreMode = () => {
      const value = new URLSearchParams(window.location.search).get('mode')
      setMode(value === 'forgot' || value === 'email' ? value : 'password')
    }
    window.addEventListener('popstate', restoreMode)
    return () => window.removeEventListener('popstate', restoreMode)
  }, [])
  const fields = action.state?.fieldErrors
  const sending = login.pending || register.pending || magic.pending || recovery.pending
  const busy = sending || verificationBusy || googleBusy
  const sent = !sending && !signup && mode !== 'password' && action.state?.success
  const form = <form ref={action.ref} action={action.dispatch} className={styles.form} aria-busy={busy} noValidate onSubmit={event => { action.onSubmit(event); if (!event.defaultPrevented) setSentTo(email) }}>
    <input type="hidden" name="next" value={context.next}/>
    <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION}/>
    <header className={styles.formHeading}><h1>{signup ? 'Hesabını oluştur' : mode === 'forgot' ? 'Şifreni yenile' : 'Tekrar hoş geldin'}<span className={styles.period}>.</span></h1>
      <p>{signup ? '14 günlük Pro denemeni başlat. Kredi kartı gerekmez.' : mode === 'forgot' ? 'Şifreni yenilemek için e-posta adresini gir.' : mode === 'email' ? 'E-postana gelen güvenli bağlantıyla giriş yap.' : 'İşletmene erişmek için giriş yap.'}</p></header>
    {message && <div className={messageKind === 'success' ? styles.successPanel : styles.formError} role={messageKind === 'success' ? 'status' : 'alert'}>{message}</div>}
    {context.plan && <p className={styles.contextSummary}>Seçimin: <strong>{context.plan === 'starter' ? 'Starter' : context.plan === 'plus' ? 'Plus' : 'Pro'} · {context.interval === 'yearly' ? 'Yıllık' : 'Aylık'}</strong><br/>İlk 14 gün Pro özelliklerini ücretsiz denersin.</p>}
    {sent && <div className={styles.successPanel} role="status"><p>Bu adresle uygun bir hesabın varsa e-posta gönderildi. Gelen kutunu ve spam klasörünü kontrol et.</p></div>}
    <div className={styles.fields}>
      {signup && <AuthField name="name" label="Ad soyad" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required error={fields?.name}/>}
      <AuthField name="email" type="email" label="E-posta" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required error={fields?.email}/>
      {(signup || mode === 'password') && <AuthField name="password" type="password" label="Şifre" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={signup ? NEW_PASSWORD_MIN_LENGTH : undefined} placeholder={signup ? 'En az 6 karakter' : undefined} required error={fields?.password}/>}
    </div>
    {signup && <><p className={styles.legalNotice}>{NEW_PASSWORD_REQUIREMENTS}</p>
      <label className={styles.termsLabel}><input name="termsAccepted" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required aria-invalid={Boolean(fields?.termsAccepted)} aria-describedby={fields?.termsAccepted ? 'terms-error' : undefined}/><span><Link href={marketing + '/yasal/abonelik-hizmet-sozlesmesi'} target="_blank">B2B Abonelik Hizmet Sözleşmesi’ni</Link> okudum ve kabul ediyorum.</span></label>
      {fields?.termsAccepted && <p id="terms-error" className={styles.fieldError}>{fields.termsAccepted}</p>}
      <p className={styles.legalNotice}>Kişisel verilerinin işlenmesi hakkında <Link href={marketing + '/yasal/kvkk-aydinlatma-metni'} target="_blank">KVKK Aydınlatma Metni’ni</Link> inceleyebilirsin.</p></>}
    {!signup && mode === 'password' && <button className={styles.forgotLink} type="button" disabled={busy} onClick={() => changeMode('forgot')}>Şifremi unuttum</button>}
    <AuthStatus state={action.state}/>
    <button type="submit" className={styles.primaryButton} disabled={busy || (mode !== 'password' && !signup && remaining > 0)} data-pending={busy || undefined}>{busy ? 'İşlem yapılıyor…' : remaining > 0 && !signup && mode !== 'password' ? 'Yeniden gönder (' + remaining + ' sn)' : signup ? 'Hesabımı oluştur' : mode === 'password' ? 'Giriş yap' : mode === 'email' ? 'Giriş bağlantısı gönder' : 'Şifre yenileme e-postası gönder'}</button>
  </form>
  return <div className={styles.formWrap}>
    {!signup && mode !== 'forgot' ? <Tabs value={mode} onValueChange={value => changeMode(String(value))}><TabsList className={styles.tabs} aria-label="Giriş yöntemi"><TabsTrigger value="password" disabled={busy}>Şifre ile</TabsTrigger><TabsTrigger value="email" disabled={busy}>E-posta bağlantısıyla</TabsTrigger></TabsList><TabsContent value="password">{mode === 'password' && form}</TabsContent><TabsContent value="email">{mode === 'email' && form}</TabsContent></Tabs> : form}
    {mode !== 'forgot' && <GoogleSignIn next={context.next} signup={signup} accepted={accepted} disabled={sending || verificationBusy} onBusyChange={setGoogleBusy}/>}
    {!signup && mode !== 'password' && !sent && !showCode && email.includes('@') && <button type="button" className={styles.backButton} disabled={busy} onClick={() => setShowCode(true)}>E-postadaki kodla devam et</button>}
    {!signup && mode !== 'password' && (sent || showCode) && <VerifyEmailForm email={sent && sentTo ? sentTo : email} next={context.next} flow={mode === 'forgot' ? 'recovery' : 'magiclink'} compact onBusyChange={setVerificationBusy} externalBusy={sending}/>}
    {!signup && mode === 'forgot' && <button type="button" className={styles.backButton} disabled={busy} onClick={() => changeMode('password')}>Girişe dön</button>}
    <div className={styles.signupPrompt}><span>{signup ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}</span><Link href={authEntryHref(signup ? '/auth/login' : '/auth/signup', context, email)}>{signup ? 'Giriş yap' : '14 gün ücretsiz dene'}</Link></div>
  </div>
}
