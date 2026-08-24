'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { CouponDefinition } from '@garsonless/domain/coupons'
import { couponStatus } from '@garsonless/domain/coupons'
import { archiveCoupon, getCouponEditorChoices, getRestaurantCoupons, restoreCoupon, upsertCoupon } from '../../lib/actions/coupons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { I } from '../../lib/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Choice = { id: string; name: string }
type Draft = {
  id?: string
  expectedUpdatedAt?: string | null
  name: string
  code: string
  enabled: boolean
  discountType: 'percentage' | 'fixed'
  discountValue: number
  scope: 'order' | 'category' | 'product'
  minimumAmount: number
  maximumDiscountAmount: number | null
  startsAt: string | null
  endsAt: string | null
  totalUsageLimit: number | null
  perCustomerLimit: number | null
  audience: 'everyone' | 'members' | 'first_order'
  stackingPolicy: 'exclusive' | 'combine_loyalty'
  marketingLabel: string | null
  marketingDescription: string | null
  categoryIds: string[]
  itemIds: string[]
}

const EMPTY: Draft = {
  name: '', code: '', enabled: true, discountType: 'percentage', discountValue: 10,
  scope: 'order', minimumAmount: 0, maximumDiscountAmount: null, startsAt: null, endsAt: null,
  totalUsageLimit: null, perCustomerLimit: null, audience: 'everyone', stackingPolicy: 'exclusive',
  marketingLabel: null, marketingDescription: null, categoryIds: [], itemIds: [],
}

const STATUS_LABELS = { active: 'Aktif', scheduled: 'Planlandı', paused: 'Duraklatıldı', expired: 'Süresi doldu', exhausted: 'Tükendi', archived: 'Arşivlendi' } as const

function toDraft(coupon: CouponDefinition): Draft {
  return { ...coupon, expectedUpdatedAt: coupon.updatedAt }
}
function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}
function isoInput(value: string) {
  return value ? new Date(value).toISOString() : null
}

export function CouponManager({ restaurantId }: { restaurantId: string }) {
  const [coupons, setCoupons] = useState<CouponDefinition[]>([])
  const [categories, setCategories] = useState<Choice[]>([])
  const [items, setItems] = useState<Choice[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<CouponDefinition | null>(null)
  const [undoArchive, setUndoArchive] = useState<{ id: string; code: string; archiveVersion: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [couponResult, choiceResult] = await Promise.all([getRestaurantCoupons(restaurantId), getCouponEditorChoices(restaurantId)])
      if ('coupons' in couponResult) setCoupons(couponResult.coupons)
      else setError(couponResult.error)
      if ('categories' in choiceResult) { setCategories(choiceResult.categories); setItems(choiceResult.items) }
    } catch { setError('Kuponlar yüklenemedi. Tekrar deneyin.') }
    finally { setLoading(false) }
  }, [restaurantId])
  useEffect(() => { void reload() }, [reload])

  const selectedChoices = useMemo(() => draft.scope === 'category' ? categories : items, [categories, draft.scope, items])
  const selectedIds = draft.scope === 'category' ? draft.categoryIds : draft.itemIds
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }))
  const toggleTarget = (id: string, checked: boolean) => {
    const next = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((value) => value !== id)
    patch(draft.scope === 'category' ? { categoryIds: next } : { itemIds: next })
  }
  const edit = (coupon?: CouponDefinition) => { setDraft(coupon ? toDraft(coupon) : EMPTY); setError(''); setOpen(true) }
  const save = () => startTransition(async () => {
    try {
      const result = await upsertCoupon(restaurantId, draft)
      if ('error' in result) { setError(result.error); return }
      setOpen(false); setError(''); await reload()
    } catch { setError('Kupon kaydedilemedi. Taslağınız korundu.') }
  })
  const archive = (coupon: CouponDefinition) => {
    startTransition(async () => {
      try {
        const result = await archiveCoupon(restaurantId, coupon.id, coupon.updatedAt)
        if ('error' in result) setError(result.error)
        else { setArchiveTarget(null); setUndoArchive({ id: coupon.id, code: coupon.code, archiveVersion: result.archiveVersion }); await reload() }
      } catch { setError('Kupon arşivlenemedi. Tekrar deneyin.') }
    })
  }
  const undo = () => {
    if (!undoArchive) return
    startTransition(async () => {
      try {
        const result = await restoreCoupon(restaurantId, undoArchive.id, undoArchive.archiveVersion)
        if ('error' in result) { setError(result.error); return }
        setUndoArchive(null); await reload()
      } catch { setError('Kupon arşivi geri alınamadı.') }
    })
  }

  return (
    <Card>
      <CardHeader className="gap-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><I.tag size={18} /></span>
            <div><CardTitle>Kuponlar</CardTitle><CardDescription>Checkout’ta doğrulanan, süreli ve kullanımı limitlenebilen indirim kodları.</CardDescription></div>
          </div>
          <Button type="button" size="sm" onClick={() => edit()}><I.plus data-icon="inline-start" />Yeni kupon</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 py-4">
        {error && !open && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {undoArchive && <Alert><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>{undoArchive.code} arşivlendi.</span><Button type="button" size="sm" variant="outline" disabled={pending} onClick={undo}>Geri al</Button></AlertDescription></Alert>}
        {loading ? <div className="flex min-h-20 items-center justify-center" role="status"><Spinner /><span className="sr-only">Kuponlar yükleniyor…</span></div> : coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Henüz kupon yok. İlk gerçek checkout kuponunuzu oluşturun.</div>
        ) : coupons.map((coupon) => {
          const status = couponStatus(coupon)
          const value = coupon.discountType === 'percentage'
            ? `%${coupon.discountValue}${coupon.maximumDiscountAmount !== null ? ` · en fazla ${coupon.maximumDiscountAmount}₺` : ''}`
            : `${coupon.discountValue}₺`
          const scope = coupon.scope === 'order' ? 'Tüm sepet' : coupon.scope === 'category' ? `${coupon.categoryIds.length} kategori` : `${coupon.itemIds.length} ürün`
          return <div key={coupon.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><I.tag size={16} /></span>
            <div className="min-w-36 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{coupon.name}</strong><Badge variant={status === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[status]}</Badge></div><div className="mt-1 text-xs text-muted-foreground"><span className="font-mono font-semibold text-foreground">{coupon.code}</span> · {value} · {scope} · {coupon.redemptionCount} kullanım</div></div>
            <div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => edit(coupon)}>Düzenle</Button><Button type="button" size="sm" variant="ghost" onClick={() => setArchiveTarget(coupon)}>Arşivle</Button></div>
          </div>
        })}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{draft.id ? 'Kuponu düzenle' : 'Yeni kupon'}</DialogTitle><DialogDescription>Kart metni ve checkout indirimi aynı kupon kaydından üretilir.</DialogDescription></DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="coupon-name">Dahili ad</FieldLabel><Input id="coupon-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ağustos karşılama" /></Field>
              <Field><FieldLabel htmlFor="coupon-code">Kupon kodu</FieldLabel><Input id="coupon-code" value={draft.code} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} placeholder="HOSGELDIN25" className="font-mono uppercase" /></Field>
            </div>
            <Field orientation="horizontal" className="rounded-lg border bg-muted/30 p-3"><div className="flex-1"><FieldLabel htmlFor="coupon-enabled">Kullanıma açık</FieldLabel><FieldDescription>Kapalı kupon sliderda görünmez ve checkout’ta uygulanmaz.</FieldDescription></div><Switch id="coupon-enabled" checked={draft.enabled} onCheckedChange={(enabled) => patch({ enabled })} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field><FieldLabel>İndirim modeli</FieldLabel><NativeSelect value={draft.discountType} onChange={(e) => patch({ discountType: e.target.value as Draft['discountType'] })}><NativeSelectOption value="percentage">Yüzde indirim</NativeSelectOption><NativeSelectOption value="fixed">Sabit tutar</NativeSelectOption></NativeSelect></Field>
              <Field><FieldLabel htmlFor="coupon-value">İndirim</FieldLabel><Input id="coupon-value" type="number" min={1} max={draft.discountType === 'percentage' ? 100 : 100000} value={draft.discountValue} onChange={(e) => patch({ discountValue: Number(e.target.value) })} /></Field>
              {draft.discountType === 'percentage' && <Field><FieldLabel htmlFor="coupon-cap">Maksimum indirim (isteğe bağlı)</FieldLabel><Input id="coupon-cap" type="number" min={1} value={draft.maximumDiscountAmount ?? ''} onChange={(e) => patch({ maximumDiscountAmount: e.target.value ? Number(e.target.value) : null })} placeholder="Sınırsız" /><FieldDescription>Boş bırakılırsa yüzde indirimi sınırsız uygulanır. Örneğin 1 yazmak indirimi ₺1 ile sınırlar.</FieldDescription></Field>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="coupon-minimum">Minimum uygun tutar (₺)</FieldLabel><Input id="coupon-minimum" type="number" min={0} value={draft.minimumAmount} onChange={(e) => patch({ minimumAmount: Number(e.target.value) })} /></Field>
            </div>
            {draft.scope !== 'order' && <Field><FieldLabel>{draft.scope === 'category' ? 'Uygun kategoriler' : 'Uygun ürünler'}</FieldLabel><div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">{selectedChoices.map((choice) => <label key={choice.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-xs hover:bg-muted"><Checkbox checked={selectedIds.includes(choice.id)} onCheckedChange={(checked) => toggleTarget(choice.id, checked === true)} />{choice.name}</label>)}</div></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="coupon-start">Başlangıç</FieldLabel><Input id="coupon-start" type="datetime-local" value={dateInput(draft.startsAt)} onChange={(e) => patch({ startsAt: isoInput(e.target.value) })} /></Field>
              <Field><FieldLabel htmlFor="coupon-end">Bitiş</FieldLabel><Input id="coupon-end" type="datetime-local" value={dateInput(draft.endsAt)} onChange={(e) => patch({ endsAt: isoInput(e.target.value) })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field><FieldLabel>Hedef kitle</FieldLabel><NativeSelect value={draft.audience} onChange={(e) => patch({ audience: e.target.value as Draft['audience'], ...(e.target.value === 'everyone' ? { perCustomerLimit: null } : {}) })}><NativeSelectOption value="everyone">Herkes</NativeSelectOption><NativeSelectOption value="members">Üyeler</NativeSelectOption><NativeSelectOption value="first_order">İlk sipariş</NativeSelectOption></NativeSelect></Field>
              <Field><FieldLabel htmlFor="coupon-total-limit">Toplam limit</FieldLabel><Input id="coupon-total-limit" type="number" min={1} value={draft.totalUsageLimit ?? ''} onChange={(e) => patch({ totalUsageLimit: e.target.value ? Number(e.target.value) : null })} placeholder="Sınırsız" /></Field>
              {draft.audience !== 'everyone' && <Field><FieldLabel htmlFor="coupon-person-limit">Kişi başı limit</FieldLabel><Input id="coupon-person-limit" type="number" min={1} value={draft.perCustomerLimit ?? ''} onChange={(e) => patch({ perCustomerLimit: e.target.value ? Number(e.target.value) : null })} placeholder="Sınırsız" /></Field>}
            </div>
            <Field><FieldLabel>Üyelik avantajları</FieldLabel><NativeSelect value={draft.stackingPolicy} onChange={(e) => patch({ stackingPolicy: e.target.value as Draft['stackingPolicy'] })}><NativeSelectOption value="exclusive">Yalnız bu kupon</NativeSelectOption><NativeSelectOption value="combine_loyalty">Üyelik avantajlarıyla birleştir</NativeSelectOption></NativeSelect><FieldDescription>Güvenli varsayılan, puan/damga ve üye indirimiyle birleşmemesidir.</FieldDescription></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="coupon-label">Kart etiketi</FieldLabel><Input id="coupon-label" value={draft.marketingLabel ?? ''} onChange={(e) => patch({ marketingLabel: e.target.value || null })} placeholder="İLK SİPARİŞE ÖZEL" /></Field>
              <Field><FieldLabel htmlFor="coupon-description">Kart açıklaması</FieldLabel><Textarea id="coupon-description" value={draft.marketingDescription ?? ''} onChange={(e) => patch({ marketingDescription: e.target.value || null })} placeholder="200₺ üzeri siparişlerde geçerli" /></Field>
            </div>
          </FieldGroup>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button><Button type="button" onClick={save} disabled={pending}>{pending && <Spinner data-icon="inline-start" />}{pending ? 'Kaydediliyor…' : 'Kuponu kaydet'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open && !pending) setArchiveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{archiveTarget?.code} kuponu arşivlensin mi?</AlertDialogTitle><AlertDialogDescription>Kupon checkout’ta kullanılamaz; geçmiş kullanımlar korunur. İşlem sonrasında geri alma seçeneği gösterilir.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); if (archiveTarget) archive(archiveTarget) }}>{pending ? 'Arşivleniyor…' : 'Kuponu arşivle'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
