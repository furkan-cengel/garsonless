'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import LoginShowcase from '../../../components/auth/LoginShowcase'
import { requestPasswordReset, sendMagicLink, signIn } from '../../../lib/actions/auth'
import { I } from '../../../lib/ui'
import styles from './login.module.css'

interface AuthInputProps {
  type?: string
  name: string
  label: string
  placeholder?: string
  autoComplete?: string
  leftIcon: ReactNode
  rightSlot?: ReactNode
  required?: boolean
}

function AuthInput({
  type = 'text',
  name,
  label,
  placeholder,
  autoComplete,
  leftIcon,
  rightSlot,
  required = true,
}: AuthInputProps): ReactElement {
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
          required={required}
        />
        {rightSlot}
      </div>
    </div>
  )
}

function FormHeading({
  title,
  description,
}: {
  title: ReactNode
  description: string
}): ReactElement {
  return (
    <header className={styles.formHeading}>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
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

function SignUpPrompt(): ReactElement {
  return (
    <div className={styles.signupPrompt}>
      <span>Hesabınız yok mu?</span>
      <Link href="/auth/signup">
        14 gün ücretsiz deneyin <I.chevRight size={14} />
      </Link>
    </div>
  )
}

function LoginForm({ onForgotPassword }: { onForgotPassword: () => void }): ReactElement {
  const [showPassword, setShowPassword] = useState(false)
  const [state, action, pending] = useActionState(signIn, null)
  const [next, setNext] = useState('')

  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get('next') ?? '')
  }, [])

  const error = state && 'error' in state ? state.error : undefined

  return (
    <form action={action} className={styles.form}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormHeading
        title={<>Tekrar hoş geldiniz<span className={styles.period}>.</span></>}
        description="İşletmenize erişmek için giriş yapın."
      />

      <div className={styles.fields}>
        <AuthInput
          type="email"
          name="email"
          label="E-posta"
          placeholder="ornek@isletme.com"
          autoComplete="email"
          leftIcon={<I.mail size={18} />}
        />

        <div className={styles.passwordField}>
          <AuthInput
            type={showPassword ? 'text' : 'password'}
            name="password"
            label="Şifre"
            placeholder="••••••••"
            autoComplete="current-password"
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
          <button type="button" className={styles.forgotLink} onClick={onForgotPassword}>
            Şifremi unuttum
          </button>
        </div>
      </div>

      <FormError message={error} />

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        <span>{pending ? 'Giriş yapılıyor…' : 'Giriş yap'}</span>
        {!pending ? <I.chevRight size={16} /> : null}
      </button>

      <SignUpPrompt />
    </form>
  )
}

function MagicLinkForm(): ReactElement {
  const [state, action, pending] = useActionState(sendMagicLink, null)

  if (state && 'success' in state) {
    return (
      <div className={styles.form}>
        <FormHeading
          title={<>E-postanızı kontrol edin<span className={styles.period}>.</span></>}
          description="Giriş bağlantısını e-posta adresinize gönderdik."
        />
        <div className={styles.successPanel} role="status">
          <span className={styles.successIcon}><I.mail size={22} /></span>
          <div>
            <strong>Bağlantı gönderildi</strong>
            <p>E-postadaki bağlantıya tıklayarak güvenle giriş yapabilirsiniz.</p>
          </div>
        </div>
      </div>
    )
  }

  const error = state && 'error' in state ? state.error : undefined

  return (
    <form action={action} className={styles.form}>
      <FormHeading
        title={<>Tekrar hoş geldiniz<span className={styles.period}>.</span></>}
        description="Size tek kullanımlık bir giriş bağlantısı gönderelim."
      />
      <div className={styles.fields}>
        <AuthInput
          type="email"
          name="email"
          label="E-posta"
          placeholder="ornek@isletme.com"
          autoComplete="email"
          leftIcon={<I.mail size={18} />}
        />
      </div>
      <FormError message={error} />
      <button type="submit" className={styles.primaryButton} disabled={pending}>
        <span>{pending ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}</span>
        {!pending ? <I.mail size={16} /> : null}
      </button>
      <SignUpPrompt />
    </form>
  )
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }): ReactElement {
  const [state, action, pending] = useActionState(requestPasswordReset, null)
  const error = state && 'error' in state ? state.error : undefined

  return (
    <div className={styles.form}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        <I.chevLeft size={15} /> Girişe dön
      </button>
      <FormHeading
        title={<>Şifrenizi yenileyin<span className={styles.period}>.</span></>}
        description="Hesabınız varsa güvenli yenileme bağlantısını e-posta adresinize göndereceğiz."
      />

      {state && 'success' in state ? (
        <div className={styles.successPanel} role="status">
          <span className={styles.successIcon}><I.mail size={22} /></span>
          <div>
            <strong>Talebiniz alındı</strong>
            <p>E-posta adresi bir hesapla eşleşiyorsa bağlantı gönderildi. Spam klasörünü de kontrol edin.</p>
          </div>
        </div>
      ) : (
        <form action={action} className={styles.resetForm}>
          <AuthInput
            type="email"
            name="email"
            label="E-posta"
            placeholder="ornek@isletme.com"
            autoComplete="email"
            leftIcon={<I.mail size={18} />}
          />
          <FormError message={error} />
          <button type="submit" className={styles.primaryButton} disabled={pending}>
            <span>{pending ? 'Gönderiliyor…' : 'Yenileme bağlantısı gönder'}</span>
            {!pending ? <I.chevRight size={16} /> : null}
          </button>
        </form>
      )}
    </div>
  )
}

type LoginTab = 'password' | 'magic' | 'forgot'

function LoginTabs(): ReactElement {
  const [tab, setTab] = useState<LoginTab>('password')

  if (tab === 'forgot') {
    return <ForgotPasswordForm onBack={() => setTab('password')} />
  }

  return (
    <div className={styles.formWrap}>
      <div className={styles.tabs} role="tablist" aria-label="Giriş yöntemi">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'password'}
          className={tab === 'password' ? styles.activeTab : undefined}
          onClick={() => setTab('password')}
        >
          Şifre ile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'magic'}
          className={tab === 'magic' ? styles.activeTab : undefined}
          onClick={() => setTab('magic')}
        >
          Magic link
        </button>
      </div>
      {tab === 'password' ? (
        <LoginForm onForgotPassword={() => setTab('forgot')} />
      ) : (
        <MagicLinkForm />
      )}
    </div>
  )
}

export default function LoginPage(): ReactElement {
  return (
    <div className={styles.page}>
      <main className={styles.authPanel}>
        <section className={styles.authContent}>
          <Link href="https://masabu.co" aria-label="Masabu ana sayfasına dön" className={styles.logoLink}>
            <Image
              src="/brand/masabu-logo-transparent.svg"
              alt="Masabu"
              width={126}
              height={34}
              priority
            />
          </Link>
          <LoginTabs />
          <footer className={styles.authFooter}>
            <span>Devam ederek Masabu’nun</span>{' '}
            <Link href="https://masabu.co/yasal/gizlilik-politikasi">Gizlilik</Link>
            {' ve '}
            <Link href="https://masabu.co/yasal/abonelik-hizmet-sozlesmesi">Hizmet sözleşmesi</Link>
            <span> koşullarını kabul etmiş olursunuz.</span>
          </footer>
        </section>
      </main>
      <LoginShowcase />
    </div>
  )
}
