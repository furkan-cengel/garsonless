'use client'

import { useState, type FormEvent } from 'react'
import { createPlatformAdminBrowserClient } from '../../../lib/supabase-browser'

export function LoginForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    const { error: authError } = await createPlatformAdminBrowserClient().auth.signInWithPassword({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    })
    if (authError) {
      setBusy(false)
      setError('Giriş bilgileri doğrulanamadı.')
      return
    }
    window.location.assign('/auth/mfa')
  }
  return (
    <form onSubmit={submit}>
      <label className="field">E-posta<input name="email" type="email" autoComplete="username" required /></label>
      <label className="field">Parola<input name="password" type="password" autoComplete="current-password" required /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button primary form-button" type="submit" disabled={busy}>{busy ? 'Doğrulanıyor…' : 'Güvenli giriş'}</button>
    </form>
  )
}
