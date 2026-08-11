'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerTimelineEvent, RestaurantCustomerDetail } from '@garsonless/domain/customers'
import { grantStoreCreditAction, loadCustomerTimelineAction } from '../../lib/actions/customers'
import { formatCurrency } from '../../lib/utils'
import { I, S } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Progress, ProgressLabel } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`
}

function initials(name: string | null): string {
  const parts = (name || 'İsimsiz').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (parts[0] ?? 'M').slice(0, 2).toUpperCase()
}

function softForTier(color: string | undefined): string {
  const c = (color ?? '').toLowerCase()
  const map: Record<string, string> = {
    '#b87333': '#f3e7dc',
    '#8a9099': '#eceef0',
    '#c8922a': '#f6ecd6',
    '#5b7a86': '#e3edf0',
  }
  return map[c] ?? 'var(--surface-3)'
}

function unpaidOrderStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    pending: 'onay bekliyor',
    pending_approval: 'onay bekliyor',
    sent_to_kitchen: 'mutfağa gönderildi',
    preparing: 'hazırlanıyor',
    ready: 'servis bekliyor',
    served: 'servis edildi',
    paid: 'ödeme kaydı bekleniyor',
  }
  return status ? (labels[status] ?? 'ödenmedi') : 'ödenmedi'
}

function timelineLabel(e: CustomerTimelineEvent): { icon: ReactNode; label: string; amount: string; positive: boolean } {
  if (e.kind === 'order') {
    const label = e.status === 'cancelled'
      ? 'Sipariş (iptal — harcamaya dahil değil)'
      : e.collected
        ? 'Sipariş (tahsil edildi)'
        : e.paid
          ? 'Sipariş (ikram — harcamaya dahil değil)'
          : `Sipariş (${unpaidOrderStatusLabel(e.status)} — harcamaya dahil değil)`
    return { icon: <I.receipt size={18} />, label, amount: formatCurrency(e.amount ?? 0), positive: false }
  }
  const delta = e.delta ?? 0
  const sign = delta >= 0 ? '+' : '−'
  const unit = e.type === 'stamp' ? ' damga' : ''
  const amount = `${sign}${Math.abs(delta)}${unit}`
  if (e.reason?.startsWith('store_credit')) return { icon: <I.gift size={18} />, label: 'Manuel puan kredisi', amount, positive: true }
  if (e.reason === 'welcome') return { icon: <I.star size={18} />, label: 'Hoş geldin bonusu', amount, positive: true }
  if (e.type === 'visit') return { icon: <I.users size={18} />, label: 'Ziyaret', amount, positive: true }
  if (e.direction === 'refund') return { icon: <I.undo size={18} />, label: e.type === 'stamp' ? 'Damga iadesi' : 'Puan iadesi', amount, positive: true }
  if (e.type === 'stamp') return { icon: <I.stamp size={18} />, label: e.direction === 'redeem' ? 'Bedava ürün' : 'Damga kazandı', amount, positive: delta >= 0 }
  return { icon: <I.star size={18} />, label: e.direction === 'redeem' ? 'Puan kullandı' : 'Puan kazandı', amount, positive: delta >= 0 }
}

export default function CustomerDetailClient({
  restaurantId,
  restaurantName,
  detail,
  canGrantStoreCredit,
  backHref,
}: {
  restaurantId: string
  restaurantName: string
  detail: RestaurantCustomerDetail
  canGrantStoreCredit: boolean
  backHref: string
}) {
  const router = useRouter()
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [grantConfirmed, setGrantConfirmed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [timeline, setTimeline] = useState(detail.timeline)
  const [timelineCursor, setTimelineCursor] = useState(detail.timelineNextCursor)
  const [timelineHasMore, setTimelineHasMore] = useState(detail.timelineHasMore)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const grantRequestId = useRef<string | null>(null)

  useEffect(() => {
    setTimeline(detail.timeline)
    setTimelineCursor(detail.timelineNextCursor)
    setTimelineHasMore(detail.timelineHasMore)
    setTimelineError(null)
  }, [detail.timeline, detail.timelineNextCursor, detail.timelineHasMore])

  const b = detail.balances
  const tier = b?.tier
  const nextTier = b?.nextTier ?? null
  const spendable = b?.points ?? 0
  const lifetime = b?.lifetimePoints ?? 0
  const progress = b?.tierProgress ?? (nextTier ? Math.min(100, Math.floor((lifetime / Math.max(1, nextTier.min)) * 100)) : 100)
  const tierColor = tier?.color ?? 'var(--text-3)'
  const tierSoft = softForTier(tier?.color)
  const tags = [
    detail.authLinked ? 'Bağlı hesap' : 'Bağlantısız kayıt',
    detail.visits >= 3 ? 'Sık gelen' : null,
    (b?.tierIndex ?? 0) >= 2 ? 'VIP' : null,
  ].filter(Boolean) as string[]

  function submitGrant() {
    const n = Math.floor(Number(points))
    if (!Number.isFinite(n) || n <= 0) { setMsg({ kind: 'err', text: 'Geçerli bir puan girin' }); return }
    if (n >= 1000 && !grantConfirmed) {
      setGrantConfirmed(true)
      setMsg({ kind: 'err', text: `${n.toLocaleString('tr-TR')} puan yüksek bir tutar. İşlemi doğrulamak için tekrar onaylayın.` })
      return
    }
    setMsg(null)
    const requestId = grantRequestId.current ?? crypto.randomUUID()
    grantRequestId.current = requestId
    startTransition(async () => {
      try {
        const res = await grantStoreCreditAction(restaurantId, detail.customerId, requestId, n, note.trim() || undefined)
        if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return }
        grantRequestId.current = null
        setMsg({ kind: 'ok', text: res.replayed ? `${res.granted} puan daha önce tanımlanmıştı` : `${res.granted} puan tanımlandı` })
        setPoints('')
        setNote('')
        setGrantConfirmed(false)
        router.refresh()
      } catch {
        setMsg({ kind: 'err', text: 'Puan tanımlama sonucu doğrulanamadı. Aynı istek güvenle yeniden denenebilir.' })
      }
    })
  }

  async function loadOlderTimeline() {
    if (!timelineCursor || timelineLoading) return
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const result = await loadCustomerTimelineAction(restaurantId, detail.customerId, timelineCursor)
      if ('error' in result) {
        setTimelineError(result.error)
        return
      }
      setTimeline((current) => {
        const known = new Set(current.map((event) => event.id))
        return [...current, ...result.events.filter((event) => !known.has(event.id))]
      })
      setTimelineCursor(result.nextCursor)
      setTimelineHasMore(result.hasMore)
    } catch {
      setTimelineError('Müşteri hareketleri yüklenemedi. Yeniden deneyin.')
    } finally {
      setTimelineLoading(false)
    }
  }

  return (
    <div className="customer-route-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title={detail.name || 'Müşteri'} backHref={backHref} />

      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-page-content" style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px 60px' }}>
          <Card className="mb-4">
            <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 border-b sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <Avatar className="row-span-2 size-14"><AvatarFallback className="text-lg font-semibold" style={{ background: tierSoft, color: tierColor }}>{initials(detail.name)}</AvatarFallback></Avatar>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CardTitle className="truncate text-2xl font-semibold tracking-tight">{detail.name || 'İsimsiz müşteri'}</CardTitle>
                {tier && <Badge variant="secondary" style={{ color: tier.color, background: tierSoft }}><span className="size-1.5 rounded-full" style={{ background: tier.color }} />{tier.name}</Badge>}
                {tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
              <CardAction className="col-span-2 col-start-1 row-start-3 mt-2 justify-self-start sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:justify-self-end">
                <Badge variant={detail.hasConsent ? 'positive' : 'secondary'}>{detail.hasConsent ? <><I.check data-icon="inline-start" />İletişim izni açık</> : 'İletişim izni kapalı'}</Badge>
              </CardAction>
              <CardDescription className="col-start-2">Kimlik, iletişim ve ziyaret özeti</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ItemGroup className="grid gap-2 sm:grid-cols-2">
                <Item variant="muted" size="xs">
                  <ItemMedia variant="icon"><I.phone /></ItemMedia>
                  <ItemContent><ItemTitle className="font-mono tabular-nums">{detail.phone}</ItemTitle><ItemDescription>{detail.phoneMasked ? 'Maskeli telefon' : 'Telefon'}</ItemDescription></ItemContent>
                </Item>
                <Item variant="muted" size="xs">
                  <ItemMedia variant="icon"><I.mail /></ItemMedia>
                  <ItemContent><ItemTitle className="font-mono">{detail.email}</ItemTitle><ItemDescription>{detail.emailMasked ? 'Maskeli e-posta' : 'E-posta'}</ItemDescription></ItemContent>
                </Item>
              </ItemGroup>
              <Separator />
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Müşteri kaydı</dt><dd className="font-medium tabular-nums">{fmtDate(detail.joinedAt)}</dd></div>
                <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">İlk ziyaret</dt><dd className="font-medium tabular-nums">{fmtDate(detail.firstSeenAt)}</dd></div>
                <div className="flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Son görülme</dt><dd className="font-medium tabular-nums">{fmtDate(detail.lastSeenAt)}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <div className="customer-detail-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon={<I.receipt size={17} />} label="HARCAMA" value={formatCurrency(detail.spend)} tone="var(--text)" mono />
            <StatCard icon={<I.users size={17} />} label="ZİYARET" value={String(detail.visits)} tone="var(--text)" />
            <StatCard icon={<I.star size={17} />} label="PUAN" value={String(spendable)} tone="#c8922a" />
            <StatCard icon={<I.star size={17} />} label="SEVİYE" value={tier?.name ?? '—'} tone={tierColor} sub={`${lifetime} ömür puanı`} dot={tierColor} />
          </div>

          {nextTier && tier && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{nextTier.name} seviyesine ilerleme</CardTitle>
                <CardDescription>Mevcut sadakat seviyesinden sonraki seviyeye ilerleme</CardDescription>
                <CardAction><Badge variant="secondary" className="tabular-nums">{Math.max(0, nextTier.min - lifetime)} puan kaldı</Badge></CardAction>
              </CardHeader>
              <CardContent>
                <Progress value={progress}>
                  <ProgressLabel className="sr-only">{nextTier.name} seviyesine ilerleme</ProgressLabel>
                </Progress>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{tier.name} · {lifetime}p</span><span>{nextTier.name} · {nextTier.min}p</span></div>
              </CardContent>
            </Card>
          )}

          {canGrantStoreCredit && <Card className="mb-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><I.gift />Puan / Kredi tanımla</CardTitle><CardDescription>Manuel puan kredisi müşterinin bakiyesine anında eklenir ve hareketlerde görünür.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
            <FieldGroup className="customer-grant-form grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)_auto]">
              <Field>
                <FieldLabel htmlFor="customer-credit-points" className="sr-only">Tanımlanacak puan</FieldLabel>
              <Input id="customer-credit-points"
                aria-label="Tanımlanacak puan"
                value={points}
                onChange={(e) => { grantRequestId.current = null; setPoints(e.target.value.replace(/[^\d]/g, '')); setGrantConfirmed(false); setMsg(null) }}
                placeholder="Puan"
                inputMode="numeric"
                className="text-center font-semibold tabular-nums"
              />
              </Field>
              <Field>
                <FieldLabel htmlFor="customer-credit-note" className="sr-only">Puan tanımlama notu</FieldLabel>
              <Input id="customer-credit-note"
                aria-label="Puan tanımlama notu"
                value={note}
                onChange={(e) => { grantRequestId.current = null; setNote(e.target.value); setGrantConfirmed(false); setMsg(null) }}
                placeholder="Not (opsiyonel)"
                maxLength={80}
              />
              </Field>
              <Field>
                <FieldLabel className="sr-only">Puanı tanımla</FieldLabel>
                <Button type="button" onClick={submitGrant} disabled={pending || !points}>{pending && <Spinner data-icon="inline-start" />}{pending ? 'Tanımlanıyor...' : grantConfirmed ? 'Puanı onayla' : 'Tanımla'}</Button>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                value={[50, 100, 250, 500].includes(Number(points)) ? [points] : []}
                onValueChange={(values) => { const next = values[0]; grantRequestId.current = null; setPoints(next ?? ''); setGrantConfirmed(false); setMsg(null) }}
                variant="outline"
                size="sm"
                aria-label="Hızlı puan tutarı"
              >
                {[50, 100, 250, 500].map((value) => <ToggleGroupItem key={value} value={String(value)}>+{value}</ToggleGroupItem>)}
              </ToggleGroup>
              <Button type="button" variant="ghost" size="xs" className="rounded-full" onClick={() => { grantRequestId.current = null; setPoints(''); setNote(''); setGrantConfirmed(false); setMsg(null) }}>Temizle</Button>
            </div>
            {msg && <Alert variant={msg.kind === 'err' ? 'destructive' : 'default'} role={msg.kind === 'err' ? 'alert' : 'status'} aria-live="polite" className="mt-3"><AlertDescription>{msg.text}</AlertDescription></Alert>}
            </CardContent>
          </Card>}

          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 className="text-base font-semibold">Hareketler</h2><p className="text-sm text-muted-foreground">Sipariş ve sadakat geçmişi</p></div>
            <Badge variant="secondary" className="tabular-nums">{timeline.length} hareket</Badge>
          </div>
          <ItemGroup>
            {timeline.length === 0 ? (
              <Card><Empty className="min-h-40"><EmptyHeader><EmptyMedia variant="icon"><I.history size={18} /></EmptyMedia><EmptyTitle>Henüz hareket yok</EmptyTitle><EmptyDescription>Müşterinin sipariş ve sadakat hareketleri burada görünür.</EmptyDescription></EmptyHeader></Empty></Card>
            ) : timeline.map((e) => {
              const t = timelineLabel(e)
              return (
                <Item key={e.id} variant="outline">
                  <ItemMedia variant="icon">{t.icon}</ItemMedia>
                  <ItemContent><ItemTitle>{t.label}</ItemTitle><ItemDescription className="tabular-nums">{fmtDateTime(e.at)}</ItemDescription></ItemContent>
                  <ItemActions><Badge variant={t.positive ? 'positive' : 'secondary'} className="font-mono tabular-nums">{t.amount}</Badge></ItemActions>
                </Item>
              )
            })}
            {timeline.length > 0 && (
              <p role="status" aria-live="polite" className="px-3 py-1 text-center text-xs text-muted-foreground">
                {timelineHasMore
                  ? `En yeni ${timeline.length} hareket gösteriliyor; daha eski hareketler mevcut.`
                  : `Gösterilen ${timeline.length} hareket, daha eski hareket kalmadı.`}
              </p>
            )}
            {timelineError && <Alert variant="destructive"><AlertDescription>{timelineError}</AlertDescription></Alert>}
            {timelineHasMore && timelineCursor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-center"
                aria-busy={timelineLoading}
                disabled={timelineLoading}
                onClick={() => { void loadOlderTimeline() }}
              >
                {timelineLoading ? <><Spinner /><span role="status" aria-live="polite">Daha eski hareketler yükleniyor…</span></> : 'Daha eski hareketleri yükle'}
              </Button>
            )}
          </ItemGroup>
          <style>{`
            .customer-page-topbar { position: sticky; top: 0; z-index: 30; }
            @media (max-width: 760px) {
              .customer-page-content { padding: 22px 20px 48px !important; }
              .customer-detail-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
            }
            @media (max-width: 460px) {
              .customer-page-content { padding: 20px 12px 44px !important; }
              .customer-detail-stats { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
  sub,
  mono,
  dot,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
  sub?: string
  mono?: boolean
  dot?: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs tracking-wide text-muted-foreground">{label}</CardTitle>
        <CardAction className="text-muted-foreground">{icon}</CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight tabular-nums" style={{ color: tone, ...(mono ? S.mono : {}) }}>
          {dot && <span className="size-2 rounded-full" style={{ background: dot }} />}{value}
        </div>
        {sub && <CardDescription className="mt-1 text-xs">{sub}</CardDescription>}
      </CardContent>
    </Card>
  )
}
