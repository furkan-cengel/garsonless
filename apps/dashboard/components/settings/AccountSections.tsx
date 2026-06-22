'use client'

import { useState, useTransition } from 'react'
import type { User } from '@supabase/supabase-js'
import { I, Tag, IconButton, btnGhost, btnPrimary } from '../../lib/ui'
import { Toggle, SCard, FormRow, DangerZone, inputStyle } from './primitives'
import { updateUserProfile } from '../../lib/actions/auth'

/* ── PROFILE ─────────────────────────────────────── */
export function ProfileSection({ user }: { user: User | null }) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  const [fullName, setFullName] = useState(str(meta['full_name']))
  const [displayName, setDisplayName] = useState(str(meta['display_name']))
  const [phone, setPhone] = useState(str(meta['phone']))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const email = user?.email ?? ''
  const initials = fullName
    ? fullName.split(' ').map((s: string) => s[0] ?? '').join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase()

  function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('full_name', fullName)
      fd.append('display_name', displayName)
      fd.append('phone', phone)
      const result = await updateUserProfile(fd)
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  return (
    <>
      <SCard title="Profil bilgisi" subtitle="Mağaza ekibi seni bu bilgilerle görür">
        <div style={{ padding: 18, display: 'flex', gap: 18, alignItems: 'flex-start', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 999,
              background: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
              color: '#5a2a14', fontWeight: 700, fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{initials}</div>
            <button style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 26, height: 26, borderRadius: 999,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-2)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-1)',
            }}><I.image size={12} /></button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Profil fotoğrafı</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>JPG, PNG veya GIF · max 4MB</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button style={btnGhost()}>Yükle</button>
              <button style={{ ...btnGhost(), color: 'var(--critical)' }}>Kaldır</button>
            </div>
          </div>
        </div>
        <FormRow label="Ad Soyad">
          <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle({ width: 240 })} />
        </FormRow>
        <FormRow label="E-posta" hint="Değiştirmek için destek ile iletişime geç">
          <input value={email} disabled style={inputStyle({ width: 240, opacity: 0.6, cursor: 'default' })} />
        </FormRow>
        <FormRow label="Telefon">
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle({ width: 200 })} />
        </FormRow>
        <FormRow label="Görüntüleme adı" hint="Siparişlerde görünür">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle({ width: 180 })} />
        </FormRow>
      </SCard>

      {error && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--critical-bg)', color: 'var(--critical)', borderRadius: 7, fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {saved ? '✓ Kaydedildi' : 'Değişiklikleri kaydet'}
        </span>
        <button onClick={handleSave} disabled={isPending} style={btnPrimary()}>
          <I.check size={13} />{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      <SCard title="Şifre & oturum" style={{ marginTop: 16 }}>
        <FormRow label="Şifre" hint="Son değişiklik 3 ay önce"><button style={btnGhost()}>Değiştir</button></FormRow>
        <FormRow label="İki faktörlü doğrulama" hint="Authenticator uygulamasıyla">
          <Toggle on={true} />
        </FormRow>
      </SCard>

      <SCard title="Aktif oturumlar" subtitle="3 cihazda açıksın" style={{ marginTop: 16 }}>
        {[
          { device: 'MacBook Pro · Chrome', loc: 'İstanbul · Türkiye', when: 'Şu an aktif', current: true },
          { device: 'iPhone · Safari', loc: 'İstanbul · Türkiye', when: '3 saat önce' },
          { device: 'iPad · garsonless app', loc: 'Mağaza Wi-Fi', when: '2 gün önce' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12,
            borderBottom: i === 2 ? 'none' : '1px solid var(--divider)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'var(--surface-3)', color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {s.device.includes('Phone') || s.device.includes('iPad')
                ? <I.phone size={15} />
                : <I.monitor size={15} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {s.device}
                {s.current && <Tag tone="positive">Şu an</Tag>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{s.loc} · {s.when}</div>
            </div>
            {!s.current && (
              <button style={{ ...btnGhost(), color: 'var(--critical)', height: 26, padding: '0 10px', fontSize: 11.5 }}>Sonlandır</button>
            )}
          </div>
        ))}
      </SCard>

      <DangerZone title="Hesabı sil" desc="Bu işlem geri alınamaz. Tüm verilerin ve mağaza erişimin silinir." />
    </>
  )
}

/* ── TEAM ─────────────────────────────────────────── */
export function TeamSection() {
  const members = [
    { name: 'Ayşe Yılmaz', email: 'ayse@acimarka.co', role: 'Sahip', active: '2 dk önce', color: '#ffd089' },
    { name: 'Burak Kaplan', email: 'burak@acimarka.co', role: 'Yönetici', active: '12 dk önce', color: '#a4f7c8' },
    { name: 'Defne Aksoy', email: 'defne@acimarka.co', role: 'Servis', active: '1 saat önce', color: '#c4d0ff' },
    { name: 'Mehmet Y.', email: 'mehmet@acimarka.co', role: 'Mutfak', active: 'Dün', color: '#f5dcea' },
    { name: 'Sevda P.', email: 'sevda@acimarka.co', role: 'Servis', active: 'Davet bekliyor', pending: true, color: '#e7e3f0' },
  ]

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Tümü 5', 'Aktif 4', 'Davet 1'].map((f, i) => (
            <button key={f} style={{
              padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
              background: i === 0 ? 'var(--surface-inset)' : 'transparent',
              color: i === 0 ? 'var(--text)' : 'var(--text-2)',
              border: '1px solid ' + (i === 0 ? 'transparent' : 'var(--border)'),
              borderRadius: 6, cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>
        <button style={btnPrimary()}><I.plus size={13} />Üye davet et</button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 130px 110px 32px',
          padding: '10px 16px', borderBottom: '1px solid var(--divider)',
          background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-3)', fontWeight: 500,
          letterSpacing: '.05em', textTransform: 'uppercase' as const,
        }}>
          <span>Üye</span><span>Rol</span><span>Son etkin</span><span></span>
        </div>
        {members.map((m, i) => {
          const roleTone = m.role === 'Sahip' ? 'positive' : m.role === 'Yönetici' ? 'warning' : 'neutral'
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 130px 110px 32px',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i === members.length - 1 ? 'none' : '1px solid var(--divider)',
              opacity: m.pending ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, background: m.color,
                  color: 'var(--accent)', fontWeight: 700, fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{m.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                </div>
              </div>
              <Tag tone={roleTone as 'positive' | 'warning' | 'neutral'}>{m.role}</Tag>
              <span style={{ fontSize: 11.5, color: m.pending ? 'var(--warning)' : 'var(--text-3)' }}>{m.active}</span>
              <IconButton icon={<I.more size={14} />} ariaLabel="Daha fazla" />
            </div>
          )
        })}
      </div>

      <SCard title="Rol & izinler" subtitle="Her rolün neyi görüp düzenleyebileceğini özelleştir" style={{ marginTop: 20 }}>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 0, fontSize: 11.5 }}>
            <div style={{ padding: '8px 4px', color: 'var(--text-3)', fontWeight: 500 }}>İzin</div>
            <div style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>Sahip</div>
            <div style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>Yönetici</div>
            <div style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600 }}>Servis</div>
            {[
              ['Sipariş alma', 'check', 'check', 'check'],
              ['Menü düzenleme', 'check', 'check', '—'],
              ['Tema değiştirme', 'check', 'check', '—'],
              ['Üye davet etme', 'check', 'check', '—'],
              ['Faturalama', 'check', '—', '—'],
              ['Mağaza silme', 'check', '—', '—'],
            ].map((row, ri) => (
              <>
                <div key={ri + '-l'} style={{ padding: '8px 4px', borderTop: '1px solid var(--divider)', fontWeight: 500 }}>{row[0]}</div>
                {row.slice(1).map((cell, j) => (
                  <div key={j} style={{ padding: '8px 4px', textAlign: 'center', borderTop: '1px solid var(--divider)' }}>
                    {cell === 'check'
                      ? <span style={{ color: 'var(--positive)' }}><I.check size={14} /></span>
                      : <span style={{ color: 'var(--text-4)' }}>—</span>}
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </SCard>
    </>
  )
}
