'use client'

import { useState, useTransition } from 'react'

type FormState = { kind: 'idle' | 'success' | 'error'; message: string }

const fieldStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 14px', border: '1.5px solid var(--line)',
  borderRadius: 10, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 14,
}

function Field({ label, name, type = 'text', placeholder, required = true }: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 650 }}>{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} style={fieldStyle} />
    </label>
  )
}

export function BusinessContactForm() {
  const [state, setState] = useState<FormState>({ kind: 'idle', message: '' })
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form).entries())
    setState({ kind: 'idle', message: '' })
    startTransition(async () => {
      try {
        const response = await fetch('/api/contact/business', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => null) as { message?: unknown } | null
        if (!response.ok) {
          setState({ kind: 'error', message: typeof payload?.message === 'string' ? payload.message : 'Talebiniz gönderilemedi. Lütfen daha sonra tekrar deneyin.' })
          return
        }
        form.reset()
        setState({ kind: 'success', message: 'Talebiniz alındı. Satış ekibimiz en kısa sürede sizinle iletişime geçecek.' })
      } catch {
        setState({ kind: 'error', message: 'Bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.' })
      }
    })
  }

  return (
    <form onSubmit={submit} style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)', padding: 32 }}>
      <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>Satış ekibimize yazın</h3>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '6px 0 20px' }}>Business ve ürün danışmanlığı taleplerinizi burada yanıtlıyoruz.</p>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Ad soyad" name="name" placeholder="Ayşe Yılmaz" />
        <Field label="E-posta" name="email" type="email" placeholder="ayse@acimarka.co" />
        <Field label="Telefon" name="phone" type="tel" placeholder="+90 555 000 00 00" />
        <Field label="İşletme adı" name="businessName" placeholder="Acımarka Restoranları" />
        <Field label="Şube sayısı" name="branchCount" type="number" placeholder="3" />
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 650 }}>Mesajınız</span>
          <textarea name="message" required rows={5} maxLength={2000} placeholder="İhtiyacınızı ve mevcut operasyonunuzu kısaca anlatın." style={{ ...fieldStyle, height: 'auto', minHeight: 120, padding: 14, resize: 'vertical' }} />
        </label>
        <label aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          Website<input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <button type="submit" disabled={pending} style={{ marginTop: 4, minHeight: 46, padding: '12px 18px', border: 0, borderRadius: 999, background: 'var(--ink)', color: '#fff', font: 'inherit', fontWeight: 750, cursor: pending ? 'wait' : 'pointer', opacity: pending ? .65 : 1 }}>
          {pending ? 'Gönderiliyor…' : 'Talebi gönder →'}
        </button>
        {state.message && <p role={state.kind === 'error' ? 'alert' : 'status'} style={{ margin: 0, color: state.kind === 'error' ? '#b42318' : 'var(--positive)', fontSize: 13, lineHeight: 1.5 }}>{state.message}</p>}
      </div>
    </form>
  )
}
