'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  useActionState,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import LoginShowcase from '../../../components/auth/LoginShowcase'
import { signUp } from '../../../lib/actions/auth'
import { I } from '../../../lib/ui'
import styles from '../login/login.module.css'

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3003'

interface SignupInputProps {
  type?: string
  name: string
  label: string
  placeholder: string
  autoComplete?: string
  autoFocus?: boolean
  leftIcon: ReactNode
  rightSlot?: ReactNode
  defaultValue?: string
  onChange?: (value: string) => void
}

function SignupInput({
  type = 'text',
  name,
  label,
  placeholder,
  autoComplete,
  autoFocus,
  leftIcon,
  rightSlot,
  defaultValue,
  onChange,
}: SignupInputProps): ReactElement {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>{label}</label>
      <div className={styles.inputShell}>
        <span className={styles.inputIcon} aria-hidden="true">{leftIcon}</span>
        <input
          id={id}
          className={styles.input}
          type={type}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          defaultValue={defaultValue}
          onChange={(event) => onChange?.(event.target.value)}
          required
        />
        {rightSlot}
      </div>
    </div>
  )
}

function passwordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

function FormError({ message }: { message?: string }): ReactElement | null {
  if (!message) return null
  return (
    <div className={styles.formError} role="alert">
      <I.warn size={15} />
      <span>{message}</span>
    </div>
  )
}

function SignupForm(): ReactElement {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [state, action, pending] = useActionState(signUp, null)
  const [next, setNext] = useState('')
  const [prefillEmail, setPrefillEmail] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedPlan = params.get('plan')
    const planNext = requestedPlan === 'starter' || requestedPlan === 'plus' || requestedPlan === 'pro'
      ? `/dashboard/onboarding?plan=${requestedPlan}`
      : ''
    setNext(params.get('next') ?? planNext)
    setPrefillEmail(params.get('email') ?? '')
  }, [])

  const strength = password ? passwordStrength(password) : 0
  const strengthLabel = strength <= 1 ? 'Zayıf' : strength === 2 ? 'Orta' : strength === 3 ? 'İyi' : 'Güçlü'
  const loginHref = next ? `/auth/login?next=${encodeURIComponent(next)}` : '/auth/login'
  const error = state && 'error' in state ? state.error : undefined

  return (
    <form action={action} className={`${styles.form} ${styles.signupForm}`}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />

      <header className={`${styles.formHeading} ${styles.signupHeading}`}>
        <h1>Hesabını oluştur<span className={styles.period}>.</span></h1>
        <p>Önce yönetici hesabını güvene al; işletmeni sonraki adımda birlikte kuracağız.</p>
      </header>

      <div className={styles.signupFields}>
        <SignupInput
          name="name"
          label="Ad soyad"
          placeholder="Ayşe Yılmaz"
          autoComplete="name"
          autoFocus
          leftIcon={<I.user size={18} />}
        />
        <SignupInput
          key={prefillEmail}
          type="email"
          name="email"
          label="İş e-postası"
          placeholder="ayse@isletme.com"
          autoComplete="email"
          defaultValue={prefillEmail}
          leftIcon={<I.mail size={18} />}
        />
        <div>
          <SignupInput
            type={showPassword ? 'text' : 'password'}
            name="password"
            label="Şifre"
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            onChange={setPassword}
            leftIcon={<I.lock size={18} />}
            rightSlot={(
              <button
                type="button"
                className={styles.inputAction}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                aria-pressed={showPassword}
              >
                {showPassword ? <I.eyeOff size={18} /> : <I.eye size={18} />}
              </button>
            )}
          />
          {password ? (
            <div className={styles.passwordStrength} aria-live="polite">
              <div className={styles.passwordStrengthBars} aria-hidden="true">
                {[1, 2, 3, 4].map((segment) => (
                  <span key={segment} data-active={segment <= strength} data-strength={strength} />
                ))}
              </div>
              <span>{strengthLabel}</span>
            </div>
          ) : null}
        </div>
      </div>

      <label className={styles.termsLabel}>
        <input
          type="checkbox"
          name="termsAccepted"
          value="on"
          required
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          <Link href={`${MARKETING_URL}/yasal/abonelik-hizmet-sozlesmesi`} target="_blank">
            B2B Abonelik Hizmet Sözleşmesi’ni
          </Link>{' '}
          okudum ve kabul ediyorum.
        </span>
      </label>

      <p className={styles.legalNotice}>
        Kişisel verilerinin işlenmesi hakkında{' '}
        <Link href={`${MARKETING_URL}/yasal/kvkk-aydinlatma-metni`} target="_blank">
          KVKK Aydınlatma Metni’ni
        </Link>{' '}
        inceleyebilirsin.
      </p>

      <FormError message={error} />

      <button type="submit" className={styles.primaryButton} disabled={!accepted || pending}>
        <span>{pending ? 'Hesap oluşturuluyor…' : 'Hesabımı oluştur'}</span>
        {!pending ? <I.chevRight size={16} /> : null}
      </button>

      <div className={styles.signupPrompt}>
        <span>Zaten hesabın var mı?</span>
        <Link href={loginHref}>Giriş yap <I.chevRight size={14} /></Link>
      </div>

    </form>
  )
}

export default function SignupPage(): ReactElement {
  return (
    <div className={styles.page}>
      <main className={`${styles.authPanel} ${styles.signupPanel}`}>
        <section className={`${styles.authContent} ${styles.signupContent}`}>
          <Link href="https://masabu.co" aria-label="Masabu ana sayfasına dön" className={styles.logoLink}>
            <Image
              src="/brand/masabu-logo-transparent.svg"
              alt="Masabu"
              width={126}
              height={34}
              priority
            />
          </Link>
          <SignupForm />
          <footer className={styles.authFooter}>
            <span>Devam ederek Masabu’nun </span>
            <Link href={`${MARKETING_URL}/yasal/gizlilik`}>Gizlilik</Link>
            <span> ve </span>
            <Link href={`${MARKETING_URL}/yasal/hizmet-sozlesmesi`}>Hizmet sözleşmesi</Link>
            <span> koşullarını kabul etmiş olursun.</span>
          </footer>
        </section>
      </main>
      <LoginShowcase />
    </div>
  )
}
