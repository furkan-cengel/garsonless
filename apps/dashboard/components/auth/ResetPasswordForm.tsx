'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setPasswordFromRecovery } from '../../lib/actions/auth'

export default function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    if (password !== confirm) {
      setMessage('Şifreler eşleşmiyor')
      return
    }
    startTransition(async () => {
      const result = await setPasswordFromRecovery({ newPassword: password })
      if ('error' in result) {
        setMessage(result.error)
        return
      }
      setPassword('')
      setConfirm('')
      setMessage('Şifren güncellendi. Artık e-posta ve şifrenle giriş yapabilirsin.')
    })
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg, #f8f7f5)' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 16, background: 'var(--surface, #fff)', border: '1px solid var(--line, #e6e3df)', boxShadow: '0 16px 48px rgba(28,24,20,.10)' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3, #777)' }}>Hesap güvenliği</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, letterSpacing: '-.03em' }}>Yeni şifre belirle</h1>
        <p style={{ margin: '0 0 22px', color: 'var(--ink-2, #555)', fontSize: 14, lineHeight: 1.5 }}>En az 8 karakter kullan. Bu bağlantı yalnız kısa süre için geçerlidir.</p>
        <label style={{ display: 'grid', gap: 6, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
          Yeni şifre
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required style={{ height: 44, borderRadius: 9, border: '1px solid var(--line, #d9d5d0)', padding: '0 12px', font: 'inherit' }} />
        </label>
        <label style={{ display: 'grid', gap: 6, marginBottom: 18, fontSize: 13, fontWeight: 600 }}>
          Yeni şifre (tekrar)
          <input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required style={{ height: 44, borderRadius: 9, border: '1px solid var(--line, #d9d5d0)', padding: '0 12px', font: 'inherit' }} />
        </label>
        {message && <p role="status" style={{ margin: '0 0 14px', fontSize: 13, color: message.startsWith('Şifren güncellendi') ? 'var(--positive, #197a4b)' : 'var(--critical, #b42318)', lineHeight: 1.45 }}>{message}</p>}
        <button type="submit" disabled={isPending || !password || !confirm} style={{ width: '100%', height: 44, border: 'none', borderRadius: 9, background: '#1c1814', color: '#fff', font: 'inherit', fontWeight: 650, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? .65 : 1 }}>
          {isPending ? 'Güncelleniyor…' : 'Şifreyi güncelle'}
        </button>
        <Link href="/auth/login" style={{ display: 'block', marginTop: 16, textAlign: 'center', color: 'var(--ink-2, #555)', fontSize: 13 }}>Girişe dön</Link>
      </form>
    </main>
  )
}
