'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { signUp } from '../../../lib/actions/auth'
import VisualPanel from '../../../components/auth/VisualPanel'
import { I } from '../../../lib/ui'

/* ─── Primitives ─── */

function AuthInput({
  type = 'text',
  name,
  placeholder,
  autoFocus,
  leftIcon,
  rightSlot,
  onChange,
}: {
  type?: string
  name: string
  placeholder?: string
  autoFocus?: boolean
  leftIcon?: React.ReactNode
  rightSlot?: React.ReactNode
  onChange?: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 46,
      background: 'var(--surface)',
      border: `1.5px solid ${focused ? 'var(--ink)' : 'var(--line)'}`,
      borderRadius: 12, transition: 'border-color 120ms',
      boxShadow: focused ? '0 0 0 4px rgba(28,24,20,.06)' : 'none',
    }}>
      {leftIcon && <span style={{ paddingLeft: 14, color: 'var(--ink-3)', flexShrink: 0 }}>{leftIcon}</span>}
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={e => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, height: '100%', padding: '0 14px',
          border: 'none', outline: 'none', background: 'transparent',
          fontSize: 15, color: 'var(--ink)', letterSpacing: '-.005em',
        }}
      />
      {rightSlot}
    </div>
  )
}

function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string
  hint?: React.ReactNode
  error?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', marginBottom: 6,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          {label}
          {optional && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 6 }}>opsiyonel</span>}
        </span>
        {hint}
      </div>
      {children}
      {error && (
        <div style={{
          fontSize: 12, color: 'var(--critical)', marginTop: 5,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <I.warn size={12} />
          {error}
        </div>
      )}
    </label>
  )
}

function passwordStrength(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

/* ─── Signup Form ─── */
function SignupForm() {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [accept, setAccept] = useState(false)
  const [state, action, pending] = useActionState(signUp, null)

  const strength = password ? passwordStrength(password) : null
  const strengthLabel = strength === null ? '' : strength <= 1 ? 'Zayıf' : strength === 2 ? 'Orta' : strength === 3 ? 'İyi' : 'Güçlü'
  const strengthColor = strength === null ? '' : strength <= 1 ? 'var(--critical)' : strength === 2 ? '#f0b429' : 'var(--positive)'

  const isSuccess = state !== null && 'success' in state

  if (isSuccess) {
    return (
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 999, margin: '0 auto 20px',
          background: 'var(--positive-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--positive)',
        }}>
          <I.check size={28} />
        </div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', margin: '0 0 12px',
        }}>
          E-postanı kontrol et
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          Hesabını onaylamak için e-postana bir doğrulama linki gönderdik.
          Spam klasörünü de kontrol etmeyi unutma.
        </p>
        <Link href="/auth/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 24, fontSize: 14, fontWeight: 600, color: 'var(--ink)',
          textDecoration: 'none',
        }}>
          ← Giriş sayfasına dön
        </Link>
      </div>
    )
  }

  return (
    <form action={action} style={{ width: '100%', maxWidth: 460 }}>
      {/* Trial badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: 'var(--positive-bg)', color: 'var(--positive)',
        fontSize: 12, fontWeight: 600, letterSpacing: '.04em', marginBottom: 16,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--positive)' }} />
        14 GÜN ÜCRETSİZ · KART GEREKMEZ
      </div>

      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em',
        lineHeight: 1.1, margin: 0, color: 'var(--ink)',
      }}>
        Hesabını <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>2 dakikada</em> kur
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 8, marginBottom: 24 }}>
        Mağazanı oluştur, ilk QR&apos;ını yazdır, siparişler düşmeye başlasın.
      </p>

      {/* Google social */}
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          style={{
            width: '100%', height: 46, padding: '0 16px',
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1.5px solid var(--line)', borderRadius: 12,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 1 1-3.4-12.9l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Google ile devam et
        </button>
      </div>

      {/* Divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        color: 'var(--ink-3)', fontSize: 12, marginBottom: 22,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span>veya e-posta ile</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>

      <Field label="Ad Soyad" optional>
        <AuthInput
          name="name"
          placeholder="Ayşe Yılmaz"
          autoFocus
          leftIcon={<I.user size={15} />}
        />
      </Field>

      <Field
        label="İş e-postası"
        hint={<span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Doğrulama linki yollayacağız</span>}
        error={state !== null && 'error' in state ? state.error : undefined}
      >
        <AuthInput
          type="email"
          name="email"
          placeholder="ayse@acimarka.co"
          leftIcon={<I.mail size={15} />}
        />
      </Field>

      <Field label="Mağaza adı" optional>
        <AuthInput
          name="biz"
          placeholder="örn. Acımarka Kafe"
          leftIcon={<I.store size={15} />}
        />
      </Field>

      <Field label="Şifre">
        <AuthInput
          type={showPass ? 'text' : 'password'}
          name="password"
          placeholder="En az 8 karakter"
          onChange={setPassword}
          leftIcon={<I.lock size={15} />}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{
                padding: '0 14px', background: 'transparent', border: 'none',
                color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0,
              }}
            >
              {showPass ? <I.eyeOff size={16} /> : <I.eye size={16} />}
            </button>
          }
        />
        {/* Strength meter */}
        {strength !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= strength ? strengthColor : 'var(--line)',
                  transition: 'background 120ms',
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 11, color: 'var(--ink-3)', fontWeight: 500,
              minWidth: 50, textAlign: 'right',
            }}>
              {strengthLabel}
            </span>
          </div>
        )}
      </Field>

      {/* Terms */}
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        cursor: 'pointer', marginBottom: 20,
      }}>
        <span style={{
          flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: 5,
          background: accept ? 'var(--ink)' : 'var(--surface)',
          border: `1.5px solid ${accept ? 'var(--ink)' : 'var(--line)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', transition: 'all 120ms',
        }}>
          {accept && <I.check size={11} />}
        </span>
        <input
          type="checkbox"
          checked={accept}
          onChange={e => setAccept(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <a href="#" style={{ color: 'var(--ink)', fontWeight: 600 }}>Hizmet şartlarını</a>
          {' '}ve{' '}
          <a href="#" style={{ color: 'var(--ink)', fontWeight: 600 }}>gizlilik politikasını</a>
          {' '}okudum, kabul ediyorum.
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={!accept || pending}
        style={{
          width: '100%', height: 50, padding: '0 18px',
          background: !accept || pending ? 'var(--ink-3)' : 'var(--ink)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 600,
          cursor: !accept || pending ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 1px 0 rgba(255,255,255,.08) inset, 0 4px 14px -4px rgba(28,24,20,.35)',
          opacity: !accept ? .5 : 1,
          transition: 'transform 100ms',
        }}
      >
        {pending ? 'Hesap oluşturuluyor…' : 'Hesabımı oluştur — 14 gün ücretsiz'}
        {!pending && <I.chevRight size={14} />}
      </button>

      <div style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-2)', textAlign: 'center' }}>
        Hesabın var mı?{' '}
        <Link href="/auth/login" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'none' }}>
          Giriş yap
        </Link>
      </div>

      {/* Trust strip */}
      <div style={{ marginTop: 28, padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Kart gerekmez', icon: <I.check size={14} /> },
            { label: '2 dk kurulum', icon: <I.clock size={14} /> },
            { label: 'KVKK uyumlu', icon: <I.shield size={14} /> },
          ].map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 500, color: 'var(--ink-2)',
            }}>
              <span style={{ color: 'var(--positive)', display: 'inline-flex' }}>{t.icon}</span>
              {t.label}
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}

/* ─── Page ─── */
export default function SignupPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <VisualPanel mode="signup" />
      <main style={{
        flex: 1, padding: '40px 64px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflowY: 'auto',
      }}>
        {/* Top-right nav */}
        <div style={{
          position: 'absolute', top: 28, right: 64,
          display: 'flex', alignItems: 'center', gap: 14,
          fontSize: 13.5, color: 'var(--ink-2)',
        }}>
          Hesabın var mı?{' '}
          <Link href="/auth/login" style={{
            color: 'var(--ink)', fontWeight: 600, textDecoration: 'none',
          }}>
            Giriş yap →
          </Link>
        </div>
        <SignupForm />
      </main>
    </div>
  )
}
