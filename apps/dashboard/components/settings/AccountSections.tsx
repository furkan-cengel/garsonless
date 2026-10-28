'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { TeamMember } from '@garsonless/db/types'
import { I, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { SCard, FormRow, inputStyle } from './primitives'
import { notifySettingsDirty, notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'
import { updateUserProfile } from '../../lib/actions/auth'
import {
  inviteMember, updateMemberPermissionsAction, setMemberStatusAction,
  removeMemberAction, resendInviteAction,
} from '../../lib/actions/team'
import { Alert, AlertDescription } from '../ui/alert'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

const TEAM_SECTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'pano', label: 'Pano' },
  { key: 'orders', label: 'Siparişler' },
  { key: 'inventory', label: 'Stok' },
  { key: 'files', label: 'Dosyalar' },
  { key: 'menu', label: 'Menü' },
  { key: 'tables', label: 'Masalar' },
  { key: 'customers', label: 'Müşteriler' },
  { key: 'analytics', label: 'Raporlar' },
  { key: 'theme', label: 'Tema' },
  { key: 'settings', label: 'Ayarlar' },
  { key: 'cash', label: 'Vardiya kasası' },
]
/** Ready-made permission sets; a person can still adjust each box afterwards. */
const TEAM_ROLE_PRESETS: { label: string; hint: string; permissions: string[] }[] = [
  { label: 'Müdür', hint: 'Ciro ve raporlar dahil her şey; ayar ve tema hariç', permissions: ['pano', 'orders', 'menu', 'tables', 'customers', 'analytics', 'inventory', 'files', 'cash'] },
  { label: 'Vardiya sorumlusu', hint: 'Servis, masalar ve vardiya kasası; raporlar yok', permissions: ['pano', 'orders', 'tables', 'customers', 'cash'] },
  { label: 'Garson', hint: 'Sipariş ve masa işleri; hiçbir tutar görmez', permissions: ['pano', 'orders', 'tables'] },
]
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((key) => b.includes(key))
const TEAM_SECTION_LABEL: Record<string, string> = Object.fromEntries(TEAM_SECTION_OPTIONS.map(o => [o.key, o.label]))

/* ── PROFILE ─────────────────────────────────────── */
export function ProfileSection({ user, onOpenSecurity }: { user: User | null; onOpenSecurity: () => void }) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')

  const [fullName, setFullName] = useState(str(meta['full_name']))
  const [displayName, setDisplayName] = useState(str(meta['display_name']))
  const [phone, setPhone] = useState(str(meta['phone']))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const profileSnapshotRef = useRef({ fullName, displayName, phone })
  const profileDirty = fullName !== profileSnapshotRef.current.fullName
    || displayName !== profileSnapshotRef.current.displayName
    || phone !== profileSnapshotRef.current.phone
  useSettingsDirtyState('profile:details', profileDirty)

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
      profileSnapshotRef.current = { fullName, displayName, phone }
      setSaved(true)
      notifySettingsSaved('profile:details')
    })
  }

  return (
    <div aria-busy={isPending}>
      <SCard
        title="Profil bilgisi"
        subtitle="Mağaza ekibi seni bu bilgilerle görür"
        footer={(
          <>
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {isPending ? 'Profil kaydediliyor…' : saved ? '✓ Profil bilgileri güncellendi' : 'Değişiklikler bu hesaba kaydedilir'}
            </span>
            <Button onClick={handleSave} disabled={isPending || !profileDirty}>
              {isPending ? <Spinner data-icon="inline-start" /> : <I.check data-icon="inline-start" />}
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        )}
      >
        <div className="flex items-center gap-4 border-b p-4">
          <Avatar className="size-16">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Profil görünümü</div>
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Adın ve görüntüleme adın ekip görünümünde ve sipariş işlemlerinde kullanılır.
            </div>
          </div>
        </div>
        <FormRow label="Ad Soyad">
          <Input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" className="w-72 max-w-full" />
        </FormRow>
        <FormRow label="E-posta" hint="E-posta adresini Güvenlik bölümünden değiştirebilirsin">
          <Input value={email} disabled type="email" autoComplete="email" className="w-72 max-w-full" />
        </FormRow>
        <div className="flex justify-end px-4 pb-3"><Button type="button" variant="link" onClick={onOpenSecurity}>E-posta adresini değiştir</Button></div>
        <FormRow label="Telefon">
          <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" className="w-72 max-w-full" />
        </FormRow>
        <FormRow label="Görüntüleme adı" hint="Siparişlerde görünür">
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-72 max-w-full" />
        </FormRow>
      </SCard>

      <SCard title="Gizlilik ve çerezler" subtitle="Bu tarayıcıdaki analitik tercihini yönet">
        <FormRow label="Çerez yönetimi" hint="Analitik çerezlerine verdiğin izni istediğin zaman değiştirebilirsin.">
          <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event('masabu:open-cookie-preferences'))}>
            Çerez tercihlerini düzenle
          </Button>
        </FormRow>
      </SCard>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

    </div>
  )
}

/* ── TEAM (owner-only; real membership) ───────────── */
function SectionCheckboxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(k: string) {
    notifySettingsDirty()
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div role="group" aria-label="Hazır roller" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TEAM_ROLE_PRESETS.map((preset) => (
          <Button key={preset.label} type="button" size="xs" variant={sameSet(value, preset.permissions) ? 'default' : 'outline'} aria-pressed={sameSet(value, preset.permissions)} title={preset.hint}
            onClick={() => { notifySettingsDirty(); onChange(preset.permissions) }}>
            {preset.label}
          </Button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {TEAM_SECTION_OPTIONS.map(opt => {
          const on = value.includes(opt.key)
          return (
            <button key={opt.key} type="button" aria-pressed={on} onClick={() => toggle(opt.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              border: '1px solid ' + (on ? 'var(--text)' : 'var(--border-strong)'),
              background: on ? 'var(--surface-inset)' : 'var(--surface)',
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                background: on ? 'var(--text)' : 'transparent',
                border: '1.5px solid ' + (on ? 'var(--text)' : 'var(--border-strong)'),
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{on && <I.check size={11} />}</span>
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{opt.label}</span>
            </button>
          )
        })}
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
        Raporlar ciroyu ve satış eğilimlerini açar. Vardiya kasası yalnızca Pano’da bugünkü tahsilatı, nakdi ve açık tutarı gösterir.
      </span>
    </div>
  )
}

function StatusTag({ status, inviteExpiresAt }: { status: TeamMember['status']; inviteExpiresAt?: string | null }) {
  if (status === 'active') return <Tag tone="positive">Aktif</Tag>
  if (status === 'disabled') return <Tag tone="neutral">Devre dışı</Tag>
  if (inviteExpiresAt && new Date(inviteExpiresAt).getTime() <= Date.now()) return <Tag tone="neutral">Süresi doldu</Tag>
  return <Tag tone="warning">Davet bekliyor</Tag>
}

function MemberRow({ restaurantId, member }: { restaurantId: string; member: TeamMember }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [perms, setPerms] = useState<string[]>(member.permissions)
  const [msg, setMsg] = useState('')
  const [devUrl, setDevUrl] = useState('')
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removePassword, setRemovePassword] = useState('')
  const [isPending, startTransition] = useTransition()

  function run(fn: () => Promise<{ error: string } | { success: true; devInviteUrl?: string }>, after?: () => void) {
    setMsg('')
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) { setMsg(res.error); return }
      if ('devInviteUrl' in res && res.devInviteUrl) setDevUrl(res.devInviteUrl)
      after?.()
      notifySettingsSaved()
      router.refresh()
    })
  }

  return (
    <div aria-busy={isPending} style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)', opacity: member.status === 'disabled' ? 0.6 : 1 }}>
      {isPending && <span role="status" aria-live="polite" className="sr-only">Ekip işlemi sürüyor…</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 999, background: 'var(--surface-3)',
          color: 'var(--text-2)', fontWeight: 700, fontSize: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{member.email.slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {member.permissions.length === 0
              ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>İzin yok</span>
              : member.permissions.map(p => (
                <span key={p} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-2)' }}>{TEAM_SECTION_LABEL[p] ?? p}</span>
              ))}
          </div>
        </div>
        <StatusTag status={member.status} inviteExpiresAt={member.inviteExpiresAt} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setEditing(e => !e)} style={btnGhost({ height: 28, padding: '0 10px', fontSize: 12 })}>İzinler</button>
          {member.status === 'invited' && (
            <button type="button" disabled={isPending} onClick={() => run(() => resendInviteAction(restaurantId, member.id))} style={btnGhost({ height: 28, padding: '0 10px', fontSize: 12 })}>Tekrar gönder</button>
          )}
          {member.status !== 'invited' && (
            <button type="button" disabled={isPending} onClick={() => run(() => setMemberStatusAction(restaurantId, member.id, member.status === 'active' ? 'disabled' : 'active'))} style={btnGhost({ height: 28, padding: '0 10px', fontSize: 12 })}>
              {member.status === 'active' ? 'Devre dışı' : 'Etkinleştir'}
            </button>
          )}
          <button type="button" disabled={isPending} onClick={() => { setRemovePassword(''); setMsg(''); setRemoveOpen(true) }} style={{ ...btnGhost({ height: 28, padding: '0 10px', fontSize: 12 }), color: 'var(--critical)' }}>Çıkar</button>
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
          <SectionCheckboxes value={perms} onChange={setPerms} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="button" disabled={isPending} onClick={() => run(() => updateMemberPermissionsAction(restaurantId, member.id, perms), () => setEditing(false))} style={btnPrimary({ height: 30, fontSize: 12.5 })}>
              {isPending ? 'Kaydediliyor…' : 'İzinleri kaydet'}
            </button>
            <button type="button" onClick={() => { setPerms(member.permissions); setEditing(false) }} style={btnGhost({ height: 30, fontSize: 12.5 })}>Vazgeç</button>
          </div>
        </div>
      )}

      {devUrl && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-all' }}>Dev davet linki: {devUrl}</div>}
      {msg && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--critical)' }}>{msg}</div>}
      <AlertDialog open={removeOpen} onOpenChange={(open) => { if (!isPending) setRemoveOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{member.email} ekipten çıkarılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu kullanıcı Dashboard erişimini hemen kaybeder. İşlemi doğrulamak için owner hesap şifrenizi girin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <label htmlFor={`remove-password-${member.id}`} className="text-sm font-medium">Hesap şifresi</label>
            <Input
              id={`remove-password-${member.id}`}
              type="password"
              value={removePassword}
              onChange={(event) => setRemovePassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending || removePassword.length === 0}
              onClick={(event) => {
                event.preventDefault()
                run(
                  () => removeMemberAction(restaurantId, member.id, removePassword),
                  () => { setRemoveOpen(false); setRemovePassword('') },
                )
              }}
            >
              {isPending ? 'Çıkarılıyor…' : 'Üyeyi ekipten çıkar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export interface TeamAuditEventView {
  id: string
  eventType: 'team_member_invited' | 'team_invite_resent' | 'team_member_permissions_updated' | 'team_member_disabled' | 'team_member_activated' | 'team_member_removed' | 'team_invite_accepted'
  targetEmail: string | null
  permissions: string[]
  createdAt: string
}

const TEAM_AUDIT_LABEL: Record<TeamAuditEventView['eventType'], string> = {
  team_member_invited: 'Ekip daveti oluşturuldu',
  team_invite_resent: 'Davet yeniden gönderildi',
  team_member_permissions_updated: 'Üye izinleri güncellendi',
  team_member_disabled: 'Üye devre dışı bırakıldı',
  team_member_activated: 'Üye etkinleştirildi',
  team_member_removed: 'Üye ekipten çıkarıldı',
  team_invite_accepted: 'Davet kabul edildi',
}

function teamAuditTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function TeamSection({ restaurantId, ownerEmail, members, auditEvents }: {
  restaurantId: string
  ownerEmail: string
  members: TeamMember[]
  auditEvents: TeamAuditEventView[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [perms, setPerms] = useState<string[]>([])
  const [result, setResult] = useState<{ ok: boolean; text: string; url?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite() {
    setResult(null)
    startTransition(async () => {
      const res = await inviteMember(restaurantId, { email, permissions: perms })
      if ('error' in res) {
        setResult({ ok: false, text: res.error })
        // A provider failure still leaves a real pending invite behind so the
        // owner can retry delivery from its row.
        if (res.invitePending) router.refresh()
        return
      }
      setResult({ ok: true, text: 'Davet gönderildi.', url: res.devInviteUrl })
      setEmail(''); setPerms([])
      notifySettingsSaved()
      router.refresh()
    })
  }

  return (
    <>
      <SCard title="Ekip üyesi davet et" subtitle="E-posta ile davet et, erişebileceği bölümleri seç">
        <div aria-busy={isPending} style={{ padding: 18 }}>
          {isPending && <span role="status" aria-live="polite" className="sr-only">Davet gönderiliyor…</span>}
          <FormRow label="E-posta">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ekip@ornek.com" style={inputStyle({ width: 280 })} />
          </FormRow>
          <div style={{ padding: '12px 0 4px', fontSize: 12.5, fontWeight: 500 }}>Erişebileceği bölümler</div>
          <SectionCheckboxes value={perms} onChange={setPerms} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button type="button" disabled={isPending || !email || perms.length === 0} onClick={handleInvite} style={btnPrimary()}>
              <I.plus size={13} />{isPending ? 'Gönderiliyor…' : 'Davet gönder'}
            </button>
            {result && <span role={result.ok ? 'status' : 'alert'} style={{ fontSize: 12.5, color: result.ok ? 'var(--positive)' : 'var(--critical)' }}>{result.text}</span>}
          </div>
          {result?.url && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-all' }}>Dev davet linki: {result.url}</div>}
        </div>
      </SCard>

      <SCard title="Ekip" subtitle={`${members.length + 1} kişi`} style={{ marginTop: 16 }}>
        {/* Owner row (source of truth = restaurants.owner_id; not editable) */}
        <div style={{ padding: '12px 16px', borderBottom: members.length ? '1px solid var(--divider)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 999, background: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
            color: '#5a2a14', fontWeight: 700, fontSize: 11, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{ownerEmail.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerEmail}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Tüm bölümlere erişim</div>
          </div>
          <Tag tone="positive">Sahip</Tag>
        </div>
        {members.map(m => <MemberRow key={m.id} restaurantId={restaurantId} member={m} />)}
        {members.length === 0 && (
          <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>
            Henüz ekip üyesi yok. Yukarıdan davet gönder.
          </div>
        )}
      </SCard>

      <SCard title="Ekip etkinliği" subtitle="Son 20 kayıt · ekip audit geçmişi 365 gün saklanır" style={{ marginTop: 16 }}>
        {auditEvents.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center' }}>
            Henüz ekip yönetimi etkinliği yok.
          </div>
        ) : auditEvents.map((event, index) => (
          <div key={event.id} style={{
            padding: '11px 16px', display: 'flex', alignItems: 'flex-start', gap: 10,
            borderBottom: index === auditEvents.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-2)', color: 'var(--text-2)',
            }}><I.users size={13} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{TEAM_AUDIT_LABEL[event.eventType]}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.45 }}>
                {event.targetEmail ?? 'Bilinmeyen üye'} · {teamAuditTime(event.createdAt)}
                {event.permissions.length > 0 && <> · {event.permissions.map(permission => TEAM_SECTION_LABEL[permission] ?? permission).join(', ')}</>}
              </div>
            </div>
          </div>
        ))}
      </SCard>
    </>
  )
}
