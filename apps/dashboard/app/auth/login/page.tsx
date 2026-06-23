'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn, sendMagicLink } from '../../../lib/actions/auth'
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
}: {
  type?: string
  name: string
  placeholder?: string
  autoFocus?: boolean
  leftIcon?: React.ReactNode
  rightSlot?: React.ReactNode
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
  children,
}: {
  label: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', marginBottom: 6,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
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

/* ─── Login Form ─── */
function LoginForm() {
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [state, action, pending] = useActionState(signIn, null)
  const [next, setNext] = useState('')
  useEffect(() => { setNext(new URLSearchParams(window.location.search).get('next') ?? '') }, [])

  return (
    <form action={action} style={{ width: '100%', maxWidth: 420 }}>
      {next && <input type="hidden" name="next" value={next} />}
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em',
        lineHeight: 1.1, margin: 0, color: 'var(--ink)',
      }}>
        Tekrar <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>hoş geldiniz</em>
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 8, marginBottom: 28 }}>
        Mağazana erişmek için hesabına gir.
      </p>

      {/* Social buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {[
          { label: 'Google', icon: (
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 1 1-3.4-12.9l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
          )},
          { label: 'Apple', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.86-3.1.39-1.13-.51-2.16-.55-3.36 0-1.5.66-2.29.5-3.16-.39C3.43 15.86 3.96 9.34 8.49 9.05c1.3.07 2.21.71 2.99.78.95-.13 1.84-.85 3.18-.74 1.55.12 2.71.74 3.46 1.86-3.06 1.83-2.34 5.87.59 7.32-.62 1.49-1.4 2.95-1.66 2.01zM12.5 8.93c-.13-2.04 1.59-3.71 3.43-3.95.25 2.18-1.94 4.06-3.43 3.95z"/>
            </svg>
          )},
        ].map(p => (
          <button
            key={p.label}
            type="button"
            style={{
              flex: 1, height: 46, padding: '0 16px',
              background: 'var(--surface)', color: 'var(--ink)',
              border: '1.5px solid var(--line)', borderRadius: 12,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'border-color 120ms, background 120ms',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--ink)'
              e.currentTarget.style.background = 'var(--bg-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            {p.icon}{p.label}
          </button>
        ))}
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

      <Field label="E-posta">
        <AuthInput
          type="email"
          name="email"
          placeholder="ayse@acimarka.co"
          autoFocus
          leftIcon={<I.mail size={16} />}
        />
      </Field>

      <Field
        label="Şifre"
        hint={
          <a href="#" style={{
            color: 'var(--brand)', textDecoration: 'none', fontSize: 12, fontWeight: 600,
          }}>
            Şifremi unuttum
          </a>
        }
        error={state && 'error' in state ? state.error : undefined}
      >
        <AuthInput
          type={showPass ? 'text' : 'password'}
          name="password"
          placeholder="••••••••"
          leftIcon={<I.lock size={16} />}
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
      </Field>

      {/* Remember me */}
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', marginBottom: 24,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          background: remember ? 'var(--ink)' : 'var(--surface)',
          border: `1.5px solid ${remember ? 'var(--ink)' : 'var(--line)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', transition: 'all 120ms',
        }}>
          {remember && <I.check size={12} />}
        </span>
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRemember(e.target.checked)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Beni hatırla</span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        style={{
          width: '100%', height: 50, padding: '0 18px',
          background: pending ? 'var(--ink-3)' : 'var(--ink)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 600, cursor: pending ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 1px 0 rgba(255,255,255,.08) inset, 0 4px 14px -4px rgba(28,24,20,.35)',
          transition: 'transform 100ms',
        }}
        onMouseDown={e => { if (!pending) e.currentTarget.style.transform = 'scale(0.985)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        {!pending && <I.chevRight size={14} />}
      </button>

      {/* Sign up banner */}
      <div style={{
        marginTop: 22, padding: 14, background: 'var(--bg-2)',
        borderRadius: 12, fontSize: 13, color: 'var(--ink-2)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}><I.user size={18} /></span>
        <div style={{ flex: 1 }}>Hesabın yok mu?</div>
        <Link href="/auth/signup" style={{
          color: 'var(--ink)', fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          14 gün ücretsiz dene <I.chevRight size={12} />
        </Link>
      </div>

      {/* Trust strip */}
      <div style={{
        marginTop: 14, fontSize: 11.5, color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <I.shield size={11} />
        SSL şifreli · KVKK uyumlu · İki faktörlü doğrulama destekli
      </div>
    </form>
  )
}

/* ─── Magic Link Form ─── */
function MagicLinkForm() {
  const [state, action, pending] = useActionState(sendMagicLink, null)

  if (state && 'success' in state) {
    return (
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em',
          lineHeight: 1.1, margin: 0, color: 'var(--ink)',
        }}>
          E-postanı <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>kontrol et</em>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 8, marginBottom: 28 }}>
          Giriş bağlantısını e-postana gönderdik.
        </p>
        <div style={{
          padding: '18px 20px', background: 'var(--bg-2)',
          border: '1.5px solid var(--line)', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 14,
          fontSize: 15, color: 'var(--ink)',
        }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><I.mail size={28} /></span>
          <div>
            <div style={{ fontWeight: 600 }}>Link gönderildi</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
              E-postadaki bağlantıya tıklayarak giriş yapabilirsin.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form action={action} style={{ width: '100%', maxWidth: 420 }}>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em',
        lineHeight: 1.1, margin: 0, color: 'var(--ink)',
      }}>
        Tekrar <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>hoş geldiniz</em>
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 8, marginBottom: 28 }}>
        E-postana tek kullanımlık giriş bağlantısı gönderelim.
      </p>

      <Field
        label="E-posta"
        error={state && 'error' in state ? state.error : undefined}
      >
        <AuthInput
          type="email"
          name="email"
          placeholder="ayse@acimarka.co"
          autoFocus
          leftIcon={<I.mail size={16} />}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        style={{
          width: '100%', height: 50, padding: '0 18px', marginTop: 8,
          background: pending ? 'var(--ink-3)' : 'var(--ink)',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 600, cursor: pending ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 1px 0 rgba(255,255,255,.08) inset, 0 4px 14px -4px rgba(28,24,20,.35)',
          transition: 'transform 100ms',
        }}
        onMouseDown={e => { if (!pending) e.currentTarget.style.transform = 'scale(0.985)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {pending ? 'Gönderiliyor…' : 'Link gönder'}
        {!pending && <I.mail size={15} />}
      </button>

      <div style={{
        marginTop: 22, padding: 14, background: 'var(--bg-2)',
        borderRadius: 12, fontSize: 13, color: 'var(--ink-2)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}><I.user size={18} /></span>
        <div style={{ flex: 1 }}>Hesabın yok mu?</div>
        <Link href="/auth/signup" style={{
          color: 'var(--ink)', fontWeight: 600, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          14 gün ücretsiz dene <I.chevRight size={12} />
        </Link>
      </div>
    </form>
  )
}

/* ─── Tab wrapper ─── */
type LoginTab = 'password' | 'magic'

function LoginTabs() {
  const [tab, setTab] = useState<LoginTab>('password')

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 2, padding: 3,
        background: 'var(--bg-2)', borderRadius: 11,
        border: '1px solid var(--line)', marginBottom: 28,
      }}>
        {([
          { id: 'password' as const, label: 'Şifre ile giriş' },
          { id: 'magic'    as const, label: 'Magic link ile giriş' },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 8, cursor: 'pointer',
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: tab === t.id ? '0 1px 0 rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)' : 'none',
              transition: 'all 120ms',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'password' ? <LoginForm /> : <MagicLinkForm />}
    </div>
  )
}

/* ─── Page ─── */
export default function LoginPage() {
  return (
    <div className="auth-page" style={{ display: 'flex', minHeight: '100vh' }}>
      <VisualPanel mode="login" />
      <main className="auth-main" style={{
        flex: 1, padding: '40px 64px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Top-right nav */}
        <div className="auth-top-link" style={{
          position: 'absolute', top: 28, right: 64,
          display: 'flex', alignItems: 'center', gap: 14,
          fontSize: 13.5, color: 'var(--ink-2)',
        }}>
          Hesabın yok mu?{' '}
          <Link href="/auth/signup" style={{
            color: 'var(--ink)', fontWeight: 600, textDecoration: 'none',
          }}>
            14 gün ücretsiz dene →
          </Link>
        </div>
        <LoginTabs />
      </main>
    </div>
  )
}
