'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CUSTOMER_NOTE_MAX_LENGTH,
  CUSTOMER_POINTS_REASON_MAX_LENGTH,
  isValidBirthday,
  type CustomerBirthday,
  type CustomerContactReveal,
  type CustomerNote,
  type CustomerTimelineEvent,
} from '@garsonless/domain/customers'
import {
  addCustomerNoteAction,
  deductCustomerPointsAction,
  deleteCustomerNoteAction,
  grantStoreCreditAction,
  loadCustomerProfileAction,
  loadCustomerTimelineAction,
  revealCustomerContactAction,
  setCustomerBirthdayAction,
  type CustomerProfileData,
} from '../../lib/actions/customers'
import { I, S } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Progress, ProgressLabel } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  fmtDate,
  fmtDateTime,
  initials,
  relTime,
  softForTier,
  tagsForCustomer,
  timelineLabel,
  undoReason,
  VIP_HINT,
  type TimelineIcon,
} from './customer-profile-model'

const TIMELINE_ICONS: Record<TimelineIcon, ReactNode> = {
  receipt: <I.receipt size={15} />,
  gift: <I.gift size={15} />,
  star: <I.star size={15} />,
  users: <I.users size={15} />,
  undo: <I.undo size={15} />,
  stamp: <I.stamp size={15} />,
  minus: <I.minus size={15} />,
}

type PointsDirection = 'add' | 'deduct'
type PointsChange = { direction: PointsDirection; points: number; reason: string }
type Toast = { text: string; undo: PointsChange | null }

export interface CustomerProfilePanelProps {
  restaurantId: string
  customerId: string
  isOwner: boolean
  viewerId: string
  referenceNow: string
  /** Server-rendered profile for the deep-link route; the side panel loads its own. */
  initial?: CustomerProfileData
  /** Set by the list when another record shares this customer's name. */
  duplicateNote?: string | null
  /** Lets the list update the row's points without reloading the page. */
  onPointsChanged?: (customerId: string, points: number) => void
  headerAction?: ReactNode
}

export default function CustomerProfilePanel(props: CustomerProfilePanelProps) {
  const { restaurantId, customerId, initial } = props
  const [profile, setProfile] = useState<CustomerProfileData | null>(initial ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const loaded = useRef(initial ? `${customerId}:0` : '')

  useEffect(() => {
    const key = `${customerId}:${reload}`
    if (loaded.current === key) return
    loaded.current = key
    let active = true
    if (reload === 0) setProfile(null)
    setLoadError(null)
    loadCustomerProfileAction(restaurantId, customerId).then((result) => {
      if (!active) return
      if ('error' in result) setLoadError(result.error)
      else setProfile(result)
    }).catch(() => {
      if (active) setLoadError('Müşteri profili yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.')
    })
    return () => { active = false }
  }, [restaurantId, customerId, reload])

  const refresh = useCallback(() => setReload((value) => value + 1), [])

  if (!profile) {
    return (
      <div className="customer-profile" aria-busy={!loadError}>
        <CustomerProfileStyles />
        {loadError ? (
          <Alert variant="destructive" className="pr-28">
            <I.warn size={16} />
            <AlertDescription>{loadError}</AlertDescription>
            <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => { loaded.current = ''; setReload((value) => value + 1) }}>Yeniden dene</Button></AlertAction>
          </Alert>
        ) : (
          <div role="status" className="customer-profile-loading"><Spinner aria-hidden="true" />Profil yükleniyor…</div>
        )}
      </div>
    )
  }
  return <><CustomerProfileStyles /><ProfileBody key={profile.detail.customerId} {...props} profile={profile} onRefresh={refresh} /></>
}

function ProfileBody({
  restaurantId,
  isOwner,
  viewerId,
  referenceNow,
  duplicateNote,
  onPointsChanged,
  headerAction,
  profile,
  onRefresh,
}: CustomerProfilePanelProps & { profile: CustomerProfileData; onRefresh: () => void }) {
  const { detail } = profile
  const b = detail.balances
  const tier = b?.tier
  const nextTier = b?.nextTier ?? null
  const spendable = b?.points ?? 0
  const lifetime = b?.lifetimePoints ?? 0
  const tierColor = tier?.color ?? 'var(--text-3)'
  const tierSoft = softForTier(tier?.color)
  const tags = tagsForCustomer({
    authLinked: detail.authLinked,
    firstSeen: detail.firstSeenAt,
    lastSeen: detail.lastSeenAt,
    visits: detail.visits,
    tierIndex: b?.tierIndex ?? 0,
  }, referenceNow)

  const [toast, setToast] = useState<Toast | null>(null)
  const [pointsOpen, setPointsOpen] = useState(false)

  useEffect(() => { onPointsChanged?.(detail.customerId, spendable) }, [detail.customerId, spendable, onPointsChanged])

  return (
    <div className="customer-profile">
      <header className="customer-profile-header">
        <Avatar className="size-12"><AvatarFallback className="text-base font-semibold" style={{ background: tierSoft, color: tierColor }}>{initials(detail.name)}</AvatarFallback></Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="customer-profile-name">{detail.name || 'İsimsiz müşteri'}</h2>
          <span style={S.caption}>İlk ziyaret {fmtDate(detail.firstSeenAt)} · son {relTime(detail.lastSeenAt, referenceNow).toLocaleLowerCase('tr-TR')}</span>
          {tags.length > 0 && (
            <div className="customer-profile-tags">
              {tags.map((tag) => <Badge key={tag} variant={tag === 'VIP' ? 'default' : 'outline'} title={tag === 'VIP' ? VIP_HINT : undefined}>{tag === 'VIP' ? 'VIP · otomatik' : tag}</Badge>)}
            </div>
          )}
        </div>
        {headerAction}
      </header>

      {duplicateNote && (
        <div role="note" className="customer-profile-duplicate"><I.users size={15} aria-hidden="true" />{duplicateNote}</div>
      )}

      {isOwner && <ContactSection restaurantId={restaurantId} customerId={detail.customerId} phone={detail.phone} email={detail.email} hasConsent={detail.hasConsent} />}
      {isOwner && <BirthdaySection key={detail.customerId} restaurantId={restaurantId} customerId={detail.customerId} initial={detail.birthday} />}

      <section aria-labelledby="customer-tier-heading" className="customer-profile-tier" style={{ background: tierSoft }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 id="customer-tier-heading" style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 650, color: tierColor }}>{tier ? `${tier.name} seviye` : 'Sadakat programı kapalı'}</h3>
          <strong style={{ ...S.mono, fontSize: 14 }}>{spendable.toLocaleString('tr-TR')} puan</strong>
        </div>
        {tier && (
          <Progress value={nextTier ? b?.tierProgress ?? 0 : 100}>
            <ProgressLabel className="sr-only">Sonraki seviyeye ilerleme</ProgressLabel>
          </Progress>
        )}
        {tier && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{nextTier ? `${nextTier.name} seviyesine ${Math.max(0, nextTier.min - lifetime).toLocaleString('tr-TR')} puan kaldı` : 'En üst seviyede'}</span>}
        {isOwner && b && !pointsOpen && (
          <div><Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => setPointsOpen(true)}>Puan ekle / düş</Button></div>
        )}
      </section>

      {isOwner && b && pointsOpen && (
        <PointsForm
          restaurantId={restaurantId}
          customerId={detail.customerId}
          spendable={spendable}
          onClose={() => setPointsOpen(false)}
          onDone={(change) => {
            setPointsOpen(false)
            setToast({ text: `${detail.name || 'Müşteri'}: ${change.points.toLocaleString('tr-TR')} puan ${change.direction === 'add' ? 'eklendi' : 'düşüldü'}.`, undo: change })
            onRefresh()
          }}
        />
      )}

      <dl className="customer-profile-stats">
        <Stat label="Ziyaret" value={detail.visits.toLocaleString('tr-TR')} />
        {detail.spend !== null && <Stat label="Toplam harcama" value={formatCurrency(detail.spend)} mono />}
        {detail.spend !== null && <Stat label="Ortalama hesap" value={formatCurrency(detail.visits > 0 ? detail.spend / detail.visits : 0)} mono />}
        <Stat label="Ömür boyu puan" value={lifetime.toLocaleString('tr-TR')} mono />
        {b?.stampEnabled && <Stat label="Damga" value={`${b.stamps}/${b.stampGoal}`} mono />}
        <Stat label="Kayıt" value={fmtDate(detail.joinedAt)} />
      </dl>

      <NotesSection restaurantId={restaurantId} customerId={detail.customerId} isOwner={isOwner} viewerId={viewerId} initial={profile.notes} />

      <TimelineSection restaurantId={restaurantId} detail={detail} />

      {toast && (
        <PointsToast
          toast={toast}
          restaurantId={restaurantId}
          customerId={detail.customerId}
          onDismiss={() => setToast(null)}
          onUndone={(text) => { setToast({ text, undo: null }); onRefresh() }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="customer-profile-stat">
      <dt>{label}</dt>
      <dd style={mono ? S.mono : undefined}>{value}</dd>
    </div>
  )
}

function ContactSection({ restaurantId, customerId, phone, email, hasConsent }: { restaurantId: string; customerId: string; phone: string; email: string; hasConsent: boolean }) {
  const [revealed, setRevealed] = useState<(CustomerContactReveal & { at: string }) | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reveal() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const result = await revealCustomerContactAction(restaurantId, customerId)
      if ('error' in result) setError(result.error)
      else if (!result.phone && !result.email) setError('Müşteri iletişim izni vermediği için bilgiler gösterilemez.')
      else setRevealed({ ...result, at: new Date().toISOString() })
    } catch {
      setError('İletişim bilgisi gösterilemedi. Yeniden deneyin.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="customer-contact-heading" className="customer-profile-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 id="customer-contact-heading" className="customer-profile-heading" style={{ flex: 1 }}>İletişim</h3>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: hasConsent ? 'var(--positive)' : 'var(--text-2)' }}>{hasConsent ? 'İletişim izni var' : 'İletişim izni yok'}</span>
      </div>
      <span style={{ ...S.mono, fontSize: 12.5 }}>{revealed?.phone ?? phone}</span>
      <span style={{ ...S.mono, fontSize: 12.5 }}>{revealed ? (revealed.email ?? 'E-posta yok') : email}</span>
      {revealed ? (
        <span role="status" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Görüntüleme kayda geçti · {fmtDateTime(revealed.at)}</span>
      ) : hasConsent ? (
        <div><Button type="button" variant="outline" size="xs" onClick={() => { void reveal() }} disabled={pending} aria-busy={pending}>{pending ? <Spinner data-icon="inline-start" /> : <I.eye data-icon="inline-start" />}İletişimi göster</Button></div>
      ) : (
        <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>İzin olmadan telefon ve e-posta maskeli kalır.</span>
      )}
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--critical)' }}>{error}</span>}
    </section>
  )
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

/** Owner-only. Day and month; staff never receive the value. */
function BirthdaySection({ restaurantId, customerId, initial }: { restaurantId: string; customerId: string; initial: CustomerBirthday | null }) {
  const [saved, setSaved] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(String(initial?.day ?? ''))
  const [month, setMonth] = useState(String(initial?.month ?? ''))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = day !== '' && month !== '' && isValidBirthday(Number(month), Number(day))

  async function save(next: { month: number; day: number } | null) {
    setPending(true)
    setError(null)
    const result = await setCustomerBirthdayAction(restaurantId, customerId, next)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setSaved(next ? { ...next, source: 'owner' } : null)
    setEditing(false)
  }

  return (
    <section aria-labelledby="customer-birthday-heading" className="customer-profile-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 id="customer-birthday-heading" className="customer-profile-heading" style={{ flex: 1 }}>Doğum günü</h3>
        {!editing && <Button type="button" variant="ghost" size="xs" onClick={() => { setEditing(true); setError(null) }}>{saved ? 'Değiştir' : 'Ekle'}</Button>}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <NativeSelect aria-label="Gün" size="sm" value={day} onChange={(e) => setDay(e.target.value)}>
            <NativeSelectOption value="">Gün</NativeSelectOption>
            {Array.from({ length: 31 }, (_, i) => <NativeSelectOption key={i + 1} value={String(i + 1)}>{i + 1}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect aria-label="Ay" size="sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            <NativeSelectOption value="">Ay</NativeSelectOption>
            {MONTHS.map((name, i) => <NativeSelectOption key={name} value={String(i + 1)}>{name}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" size="xs" disabled={!valid || pending} onClick={() => { void save({ month: Number(month), day: Number(day) }) }}>Kaydet</Button>
          {saved && <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => { void save(null) }}>Kaldır</Button>}
          <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => { setEditing(false); setError(null) }}>Vazgeç</Button>
        </div>
      ) : (
        <span style={{ fontSize: 12.5 }}>
          {saved ? `${saved.day} ${MONTHS[saved.month - 1]}` : 'Girilmemiş'}
          {saved && <span style={{ color: 'var(--text-2)' }}> · {saved.source === 'customer' ? 'müşteri girdi' : 'sen girdin'}</span>}
        </span>
      )}
      {day !== '' && month !== '' && !valid && <span role="alert" style={{ fontSize: 12, color: 'var(--critical)' }}>Bu ayda o gün yok.</span>}
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--critical)' }}>{error}</span>}
    </section>
  )
}

function PointsForm({ restaurantId, customerId, spendable, onClose, onDone }: {
  restaurantId: string
  customerId: string
  spendable: number
  onClose: () => void
  onDone: (change: PointsChange) => void
}) {
  const [direction, setDirection] = useState<PointsDirection>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirmLarge, setConfirmLarge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // One id per intent: an ambiguous failure is retried with the same id, so the ledger never doubles it.
  const requestId = useRef<string | null>(null)
  const points = Math.floor(Number(amount))
  const validPoints = Number.isFinite(points) && points > 0
  const overBalance = direction === 'deduct' && validPoints && points > spendable
  const blocked = !validPoints || !reason.trim() || overBalance || pending

  function changed() {
    requestId.current = null
    setConfirmLarge(false)
    setError(null)
  }

  async function submit() {
    if (blocked) return
    if (points >= 1000 && !confirmLarge) { setConfirmLarge(true); return }
    const id = requestId.current ?? crypto.randomUUID()
    requestId.current = id
    setPending(true)
    setError(null)
    const request = { customerId, requestId: id, points, reason: reason.trim() }
    try {
      const result = direction === 'add'
        ? await grantStoreCreditAction(restaurantId, request)
        : await deductCustomerPointsAction(restaurantId, request)
      if ('error' in result) { setError(result.error); return }
      requestId.current = null
      onDone({ direction, points, reason: request.reason })
    } catch {
      setError('Sonuç doğrulanamadı. Aynı istek güvenle yeniden denenebilir.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="customer-profile-card customer-points-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
      <ToggleGroup
        value={[direction]}
        onValueChange={(values) => { const next = values[0]; if (next === 'add' || next === 'deduct') { setDirection(next); changed() } }}
        variant="outline"
        size="sm"
        className="w-full"
        aria-label="İşlem"
      >
        <ToggleGroupItem value="add" className="flex-1">Puan ekle</ToggleGroupItem>
        <ToggleGroupItem value="deduct" className="flex-1">Puan düş</ToggleGroupItem>
      </ToggleGroup>
      <Field>
        <FieldLabel htmlFor="customer-points-amount">Puan</FieldLabel>
        <Input id="customer-points-amount" inputMode="numeric" value={amount} placeholder="Örn. 100" className="tabular-nums" aria-invalid={overBalance || undefined} aria-describedby={overBalance ? 'customer-points-balance' : undefined}
          onChange={(event) => { setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 7)); changed() }} />
        {direction === 'deduct' && <FieldDescription id="customer-points-balance">{overBalance ? `Bakiye ${spendable.toLocaleString('tr-TR')} puan; daha fazlası düşülemez.` : `Kullanılabilir bakiye: ${spendable.toLocaleString('tr-TR')} puan`}</FieldDescription>}
      </Field>
      <Field>
        <FieldLabel htmlFor="customer-points-reason">Sebep (zorunlu)</FieldLabel>
        <Input id="customer-points-reason" value={reason} maxLength={CUSTOMER_POINTS_REASON_MAX_LENGTH} placeholder={direction === 'add' ? 'Örn. hatalı sipariş telafisi' : 'Örn. yanlışlıkla eklendi'}
          onChange={(event) => { setReason(event.target.value); changed() }} />
        <FieldDescription>Hareketlerde bu sebeple görünür.</FieldDescription>
      </Field>
      {confirmLarge && <Alert role="status"><AlertDescription>{points.toLocaleString('tr-TR')} puan yüksek bir tutar. Doğruysa bir kez daha onayla.</AlertDescription></Alert>}
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>Vazgeç</Button>
        <Button type="submit" size="sm" disabled={blocked} aria-busy={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {!validPoints ? 'Kaydet' : confirmLarge ? 'Onayla' : `${points.toLocaleString('tr-TR')} puan ${direction === 'add' ? 'ekle' : 'düş'}`}
        </Button>
      </div>
    </form>
  )
}

function PointsToast({ toast, restaurantId, customerId, onDismiss, onUndone }: {
  toast: Toast
  restaurantId: string
  customerId: string
  onDismiss: () => void
  onUndone: (text: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef<string | null>(null)

  useEffect(() => {
    if (toast.undo || pending) return
    const timer = setTimeout(onDismiss, 6000)
    return () => clearTimeout(timer)
  }, [toast, pending, onDismiss])

  async function undo() {
    const change = toast.undo
    if (!change || pending) return
    const id = requestId.current ?? crypto.randomUUID()
    requestId.current = id
    setPending(true)
    setError(null)
    // Undo writes the opposite ledger entry; the original stays visible in the history.
    const request = { customerId, requestId: id, points: change.points, reason: undoReason(change.reason) }
    try {
      const result = change.direction === 'add'
        ? await deductCustomerPointsAction(restaurantId, request)
        : await grantStoreCreditAction(restaurantId, request)
      if ('error' in result) { setError(result.error); return }
      onUndone('Geri alındı.')
    } catch {
      setError('Geri alma doğrulanamadı. Yeniden deneyin.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div role="status" aria-live="polite" className="customer-toast">
      <span>{error ?? toast.text}</span>
      {toast.undo && <Button type="button" size="sm" variant="secondary" onClick={() => { void undo() }} disabled={pending} aria-busy={pending}>{pending && <Spinner data-icon="inline-start" />}Geri al</Button>}
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Bildirimi kapat" className="text-inherit" onClick={onDismiss}><I.close size={14} /></Button>
    </div>
  )
}

function NotesSection({ restaurantId, customerId, isOwner, viewerId, initial }: { restaurantId: string; customerId: string; isOwner: boolean; viewerId: string; initial: CustomerNote[] }) {
  const [notes, setNotes] = useState(initial)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const body = draft.trim()
    if (!body || pending) return
    setPending(true)
    setError(null)
    try {
      const result = await addCustomerNoteAction(restaurantId, customerId, body)
      if ('error' in result) { setError(result.error); return }
      setNotes((current) => [result, ...current])
      setDraft('')
    } catch {
      setError('Not kaydedilemedi. Yeniden deneyin.')
    } finally {
      setPending(false)
    }
  }

  async function remove(note: CustomerNote) {
    setError(null)
    setNotes((current) => current.filter((item) => item.id !== note.id))
    try {
      const result = await deleteCustomerNoteAction(restaurantId, customerId, note.id)
      if ('error' in result) throw new Error(result.error)
    } catch (cause) {
      setNotes((current) => [note, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setError(cause instanceof Error && cause.message ? cause.message : 'Not silinemedi.')
    }
  }

  return (
    <section aria-labelledby="customer-notes-heading" className="customer-profile-section">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 id="customer-notes-heading" className="customer-profile-heading" style={{ flex: 1 }}>Notlar</h3>
        <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Ekip görür, müşteri görmez</span>
      </div>
      {notes.map((note) => (
        <div key={note.id} className="customer-note">
          <p>{note.body}</p>
          <span className="customer-note-meta">
            {note.authorLabel} · {fmtDateTime(note.createdAt)}
            {(isOwner || note.authorId === viewerId) && (
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Notu sil" onClick={() => { void remove(note) }}><I.trash size={12} /></Button>
            )}
          </span>
        </div>
      ))}
      <form style={{ display: 'flex', gap: 6 }} onSubmit={(event) => { event.preventDefault(); void add() }}>
        <label htmlFor="customer-note-draft" className="sr-only">Yeni not</label>
        <Input id="customer-note-draft" value={draft} maxLength={CUSTOMER_NOTE_MAX_LENGTH} placeholder="Not ekle: alerji, tercih, özel gün…" onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" variant="outline" disabled={!draft.trim() || pending} aria-busy={pending}>{pending && <Spinner data-icon="inline-start" />}Ekle</Button>
      </form>
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--critical)' }}>{error}</span>}
    </section>
  )
}

function TimelineSection({ restaurantId, detail }: { restaurantId: string; detail: CustomerProfileData['detail'] }) {
  const [timeline, setTimeline] = useState<CustomerTimelineEvent[]>(detail.timeline)
  const [cursor, setCursor] = useState(detail.timelineNextCursor)
  const [hasMore, setHasMore] = useState(detail.timelineHasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTimeline(detail.timeline)
    setCursor(detail.timelineNextCursor)
    setHasMore(detail.timelineHasMore)
    setError(null)
  }, [detail.timeline, detail.timelineNextCursor, detail.timelineHasMore])

  async function loadOlder() {
    if (!cursor || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await loadCustomerTimelineAction(restaurantId, detail.customerId, cursor)
      if ('error' in result) { setError(result.error); return }
      setTimeline((current) => {
        const known = new Set(current.map((event) => event.id))
        return [...current, ...result.events.filter((event) => !known.has(event.id))]
      })
      setCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch {
      setError('Müşteri hareketleri yüklenemedi. Yeniden deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="customer-history-heading" className="customer-profile-section">
      <h3 id="customer-history-heading" className="customer-profile-heading">Hareketler</h3>
      {timeline.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-2)' }}>Henüz sipariş ya da sadakat hareketi yok.</p>
      ) : (
        <ul className="customer-history">
          {timeline.map((event) => {
            const line = timelineLabel(event, formatCurrency)
            return (
              <li key={event.id}>
                <span className="customer-history-icon" aria-hidden="true">{TIMELINE_ICONS[line.icon]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{line.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{fmtDateTime(event.at)}</span>
                </span>
                {line.amount && <strong style={{ ...S.mono, fontSize: 12, color: line.positive ? 'var(--positive)' : event.kind === 'order' ? 'var(--text)' : 'var(--critical)' }}>{line.amount}</strong>}
              </li>
            )
          })}
        </ul>
      )}
      {timeline.length > 0 && (
        <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 11.5, color: 'var(--text-2)', textAlign: 'center' }}>
          {hasMore ? `En yeni ${timeline.length} hareket gösteriliyor; daha eski hareketler mevcut.` : `Gösterilen ${timeline.length} hareket, daha eski hareket kalmadı.`}
        </p>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {hasMore && cursor && (
        <Button type="button" variant="outline" size="sm" className="self-center" aria-busy={loading} disabled={loading} onClick={() => { void loadOlder() }}>
          {loading ? <><Spinner /><span>Daha eski hareketler yükleniyor…</span></> : 'Daha eski hareketleri yükle'}
        </Button>
      )}
    </section>
  )
}

/** Profile styles live with the panel so the list route and the deep-link route share them. */
function CustomerProfileStyles() {
  return (
    <style>{`
      .customer-profile { display: flex; flex-direction: column; gap: 14px; padding: 16px; min-width: 0; }
      .customer-profile-loading { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 160px; color: var(--text-2); font-size: 13px; }
      .customer-profile-header { display: flex; align-items: flex-start; gap: 12px; }
      .customer-profile-name { margin: 0; font-size: 19px; font-weight: 650; letter-spacing: -0.015em; overflow-wrap: anywhere; }
      .customer-profile-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
      .customer-profile-duplicate { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 10px; background: var(--warning-bg); color: var(--warning); font-size: 12.5px; }
      .customer-profile-card { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
      .customer-points-form { border-color: var(--text); }
      .customer-profile-tier { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; }
      .customer-profile-heading { margin: 0; font-size: 12.5px; font-weight: 650; }
      .customer-profile-section { display: flex; flex-direction: column; gap: 8px; }
      .customer-profile-stats { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .customer-profile-stat { padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; min-width: 0; }
      .customer-profile-stat dt { font-size: 11px; color: var(--text-2); }
      .customer-profile-stat dd { margin: 1px 0 0; font-size: 15px; font-weight: 650; overflow-wrap: anywhere; }
      .customer-note { padding: 8px 10px; border-radius: 9px; background: var(--warning-bg); border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent); font-size: 12.5px; }
      .customer-note p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .customer-note-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; font-size: 11px; color: var(--text-2); }
      .customer-history { list-style: none; margin: 0; padding: 0; }
      .customer-history li { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
      .customer-history-icon { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--surface-3); color: var(--text-2); }
      .customer-toast { position: fixed; left: 50%; bottom: 20px; z-index: 60; transform: translateX(-50%); width: max-content; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border-radius: 12px; background: var(--action); color: #fff; box-shadow: 0 12px 30px rgba(17,17,19,.25); font-size: 13px; }
      @media (pointer: coarse) {
        .customer-profile button { min-height: 44px; }
        .customer-note-meta button { min-width: 44px; }
      }
    `}</style>
  )
}
