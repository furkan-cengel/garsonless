'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { acceptInviteAction } from '../../lib/actions/team'
import { logoutCurrentBrowser } from '../../lib/client-logout'

const SECTION_LABELS: Record<string, string> = {
  pano: 'Pano', orders: 'Siparişler', menu: 'Menü', tables: 'Masalar',
  customers: 'Müşteriler', analytics: 'Raporlar', theme: 'Tema', settings: 'Ayarlar',
}

type State = 'invalid' | 'anon' | 'match' | 'mismatch'

interface Props {
  state: State
  token?: string
  restaurantName?: string
  email?: string
  permissions?: string[]
  next?: string
  inviteEmail?: string
  currentEmail?: string
}

const card: React.CSSProperties = {
  width: '100%', maxWidth: 460, background: 'var(--surface)',
  border: '1.5px solid var(--line)', borderRadius: 16, padding: 32,
}
const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
}
const h2: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 500,
  letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)',
}
function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', height: 48, border: 'none', borderRadius: 12,
    background: disabled ? 'var(--ink-3)' : 'var(--ink)', color: '#fff',
    fontSize: 15, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  }
}
const ghostBtn: React.CSSProperties = {
  width: '100%', height: 46, borderRadius: 12, background: 'var(--surface)',
  border: '1.5px solid var(--line)', color: 'var(--ink)', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
}

function PermChips({ permissions }: { permissions: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
      {permissions.map((p) => (
        <span key={p} style={{
          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
          background: 'var(--brand-soft)', color: 'var(--brand)',
        }}>{SECTION_LABELS[p] ?? p}</span>
      ))}
    </div>
  )
}

export default function AcceptInviteClient(props: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    if (!props.token) return
    setError('')
    startTransition(async () => {
      const res = await acceptInviteAction(props.token!)
      if ('redirectTo' in res) { router.push(res.redirectTo); return }
      setError(
        res.error === 'invalid_or_expired' ? 'Davet bağlantısı geçersiz veya süresi dolmuş.'
        : res.error === 'email_mismatch' ? 'Bu davet farklı bir e-posta için.'
        : res.error === 'not_authenticated' ? 'Oturum bulunamadı.'
        : 'Davet kabul edilemedi.',
      )
    })
  }

  function handleMismatchLogout() {
    setError('')
    startTransition(async () => {
      const result = await logoutCurrentBrowser()
      if ('error' in result) {
        setError(result.error)
        return
      }
      window.location.replace('/auth/login')
    })
  }

  if (props.state === 'invalid') {
    return (
      <div style={wrap}><div style={card}>
        <h2 style={h2}>Davet geçersiz</h2>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 10 }}>
          Bu davet bağlantısı geçersiz veya süresi dolmuş. İşletme sahibinden yeni bir davet isteyin.
        </p>
        <Link href="/auth/login" style={{ ...ghostBtn, marginTop: 20 }}>Girişe dön</Link>
      </div></div>
    )
  }

  if (props.state === 'mismatch') {
    return (
      <div style={wrap}><div style={card}>
        <h2 style={h2}>Farklı hesap</h2>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 10 }}>
          Bu davet <b>{props.inviteEmail}</b> için. Şu anda <b>{props.currentEmail}</b> ile giriş yaptınız.
          Daveti kabul etmek için doğru hesapla giriş yapın.
        </p>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--critical)', marginTop: 16 }}>{error}</div>}
        <button type="button" onClick={handleMismatchLogout} disabled={isPending} style={{ ...primaryBtn(isPending), marginTop: 20 }}>
          {isPending ? 'Çıkış yapılıyor…' : 'Çıkış yap ve değiştir'}
        </button>
      </div></div>
    )
  }

  if (props.state === 'anon') {
    const loginHref = `/auth/login?next=${encodeURIComponent(props.next ?? '')}`
    const signupHref = `/auth/signup?next=${encodeURIComponent(props.next ?? '')}&email=${encodeURIComponent(props.email ?? '')}`
    return (
      <div style={wrap}><div style={card}>
        <h2 style={h2}><em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>{props.restaurantName}</em> ekibine davetlisiniz</h2>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 10 }}>
          <b>{props.email}</b> olarak davet edildiniz. Kabul etmek için giriş yapın ya da hesap oluşturun.
        </p>
        <PermChips permissions={props.permissions ?? []} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          <Link href={loginHref} style={{ ...ghostBtn, background: 'var(--ink)', color: '#fff', border: 'none', height: 48, fontSize: 15 }}>Giriş yap</Link>
          <Link href={signupHref} style={ghostBtn}>Hesap oluştur</Link>
        </div>
      </div></div>
    )
  }

  // match
  return (
    <div style={wrap}><div style={card}>
      <h2 style={h2}><em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>{props.restaurantName}</em> ekibine katıl</h2>
      <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 10 }}>
        <b>{props.email}</b> olarak davet edildiniz. Şu bölümlere erişiminiz olacak:
      </p>
      <PermChips permissions={props.permissions ?? []} />
      {error && <div style={{ fontSize: 13, color: 'var(--critical)', marginTop: 16 }}>{error}</div>}
      <button onClick={handleAccept} disabled={isPending} style={{ ...primaryBtn(isPending), marginTop: 22 }}>
        {isPending ? 'Kabul ediliyor…' : 'Daveti kabul et'}
      </button>
    </div></div>
  )
}
