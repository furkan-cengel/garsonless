'use client'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CANONICAL_THEME_ID } from '@garsonless/design-engine'
import {
  ADD_ON_DEFINITIONS,
  type RestaurantAddOn,
  type RestaurantPlan,
} from '@garsonless/domain/entitlements'
import {
  canPurchaseAddOn,
  formatAddOnMoney as money,
  type AddOnStore,
} from '@garsonless/domain/add-on-purchases'
import {
  startAddOnPurchaseAction,
  checkAddOnPurchaseAction,
  readAddOnStoreAction,
} from '../../lib/actions/add-on-purchases'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Checkbox } from '../ui/checkbox'
import { Field, FieldLabel } from '../ui/field'
import { Spinner } from '../ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'

export function AddOnBilling({
  restaurantId,
  plan,
  accessAllowed,
  profileSummary,
  saveProfile,
}: {
  restaurantId: string
  plan: RestaurantPlan
  accessAllowed: boolean
  profileSummary: string
  saveProfile: () => Promise<{ error?: string }>
}) {
  const query = useSearchParams()
  const router = useRouter()
  const [store, setStore] = useState<AddOnStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<RestaurantAddOn | null>(
    query.get('addon') === 'storefront_video_hero'
      ? 'storefront_video_hero'
      : query.get('addon') === 'iyzico_online_payments'
        ? 'iyzico_online_payments'
        : null,
  )
  const [accepted, setAccepted] = useState(false)
  const [pending, transition] = useTransition()
  const load = useCallback(async () => {
    const result = await readAddOnStoreAction(restaurantId)
    if ('error' in result) setMessage(result.error ?? 'İşlem tamamlanamadı.')
    else setStore(result.store)
    setLoading(false)
  }, [restaurantId])
  useEffect(() => {
    void load()
  }, [load])
  const check = useCallback(
    async (id: string) => {
      const result = await checkAddOnPurchaseAction(restaurantId, id)
      if ('error' in result) {
        setMessage(result.error ?? 'İşlem tamamlanamadı.')
        return
      }
      await load()
      if (result.status === 'paid') {
        router.replace(result.returnPath)
        router.refresh()
      } else
        setMessage(
          result.status === 'failed'
            ? 'Ödeme başarısız. Yeniden satın alabilirsin.'
            : result.status === 'review'
              ? 'Ödemen inceleniyor; onaylandığında eklentin açılacak.'
              : 'Ödemen henüz doğrulanmadı. Ödeme sayfasından devam edebilir veya durumu tekrar kontrol edebilirsin.',
        )
    },
    [load, restaurantId, router],
  )
  const returnPurchaseId = query.get('purchase')
  useEffect(() => {
    if (returnPurchaseId) void check(returnPurchaseId)
  }, [returnPurchaseId, check])
  async function buy() {
    if (!selected || !accepted) return
    const price = store?.prices.find((p) => p.addOn === selected)
    if (!price) return
    const saved = await saveProfile()
    if (saved.error) {
      setMessage(saved.error)
      return
    }
    const result = await startAddOnPurchaseAction(restaurantId, {
      addOn: selected,
      priceVersion: price.version,
      requestId: crypto.randomUUID(),
      termsAccepted: true,
      returnContext:
        selected === 'storefront_video_hero' &&
        query.get('template') === CANONICAL_THEME_ID
          ? {
              templateId: CANONICAL_THEME_ID,
              sectionId: 'storefront-video-hero',
            }
          : null,
    })
    if ('error' in result) {
      setMessage(result.error ?? 'İşlem tamamlanamadı.')
      return
    }
    if (result.status === 'paid') {
      await check(result.purchaseId)
      return
    }
    if (result.paymentPageUrl) window.location.assign(result.paymentPageUrl)
    else {
      setMessage(
        'Ödeme hazırlanıyor. Yeniden ödeme başlatmadan işlem durumunu kontrol et.',
      )
      await load()
    }
  }
  const price = store?.prices.find((p) => p.addOn === selected)
  return (
    <section id="addons" className="flex flex-col gap-4">
      <div>
        <h2>Eklentiler</h2>
        <p>
          Tek seferlik ödeme · Bu işletmede ömür boyu. Abonelik yenileme tarihin
          değişmez.
        </p>
      </div>
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {!store ? (
        loading ? (
          <p role="status">Eklenti fiyatları yükleniyor…</p>
        ) : (
          <Button variant="outline" onClick={() => void load()}>
            Kataloğu yeniden yükle
          </Button>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {store.prices.map((item) => {
            const owned = store.owned.includes(item.addOn)
            const included =
              item.addOn === 'storefront_video_hero' &&
              ['pro', 'business'].includes(plan)
            const available =
              accessAllowed && canPurchaseAddOn(item.addOn, plan)
            return (
              <Card key={item.addOn}>
                <CardHeader>
                  <CardTitle>{ADD_ON_DEFINITIONS[item.addOn].label}</CardTitle>
                  <CardDescription>
                    {ADD_ON_DEFINITIONS[item.addOn].description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <strong>{money(item.netAmountMinor)} + KDV</strong>
                  <span>
                    Toplam {money(item.totalAmountMinor)} · Tek seferlik
                  </span>
                  {owned ? (
                    <Badge>Satın alındı</Badge>
                  ) : included ? (
                    <Badge variant="secondary">Paketine dahil</Badge>
                  ) : null}
                  {owned &&
                    item.addOn === 'iyzico_online_payments' &&
                    plan !== 'pro' && (
                      <p>
                        Satın alma hakkın korunuyor. Kullanım için Pro gerekir.
                      </p>
                    )}
                </CardContent>
                <CardFooter>
                  <Button
                    disabled={
                      owned || included || !available || !item.active || pending
                    }
                    onClick={() => {
                      setAccepted(false)
                      setSelected(item.addOn)
                    }}
                  >
                    {owned
                      ? 'Satın alındı'
                      : included
                        ? 'Paketine dahil'
                        : !accessAllowed
                          ? 'Önce aboneliği etkinleştir'
                          : !available
                            ? 'Pro paket gerekir'
                            : !item.active
                              ? 'Satışa kapalı'
                              : 'Satın al'}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      {store?.purchases.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <span>
              {ADD_ON_DEFINITIONS[p.addOn].label} · {money(p.totalAmountMinor)}{' '}
              ·{' '}
              {p.status === 'paid'
                ? 'Satın alındı'
                : p.status === 'failed'
                  ? 'Başarısız'
                  : p.status === 'refunded'
                    ? 'İade edildi'
                    : p.status === 'chargeback'
                      ? 'Ödeme geri alındı'
                      : 'Ödeme bekleniyor'}
            </span>
            {p.status === 'pending' && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  transition(async () => {
                    const result = await checkAddOnPurchaseAction(
                      restaurantId,
                      p.id,
                    )
                    if (
                      'success' in result &&
                      result.status === 'pending' &&
                      result.paymentPageUrl
                    )
                      window.location.assign(result.paymentPageUrl)
                    else await check(p.id)
                  })
                }
              >
                Ödemeye devam et
              </Button>
            )}
            {['initializing', 'pending', 'review'].includes(p.status) && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  transition(async () => {
                    await check(p.id)
                  })
                }
              >
                Durumu kontrol et
              </Button>
            )}
            {p.documentReady && (
              <Button
                variant="outline"
                render={
                  <a
                    href={`/api/restaurants/${restaurantId}/billing/add-ons/${p.id}/document`}
                  />
                }
              >
                Faturayı indir
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected ? ADD_ON_DEFINITIONS[selected].label : 'Eklenti'} satın
              al
            </DialogTitle>
            <DialogDescription>
              Bu işletmede ömür boyu kullanım hakkı. Eklenti için tekrar ücret
              alınmaz; kullanım aktif abonelik ve paket koşullarına bağlıdır.
            </DialogDescription>
          </DialogHeader>
          {price && (
            <>
              <p>
                {money(price.netAmountMinor)} +{' '}
                {money(price.totalAmountMinor - price.netAmountMinor)} KDV
              </p>
              <strong>Toplam: {money(price.totalAmountMinor)}</strong>
              <div className="rounded-lg border p-3">
                <strong>Fatura bilgileri</strong>
                <p>{profileSummary}</p>
              </div>
              <Field orientation="horizontal">
                <Checkbox
                  id="addon-terms"
                  checked={accepted}
                  onCheckedChange={(value) => setAccepted(value === true)}
                />
                <FieldLabel htmlFor="addon-terms">
                  Tek seferlik ödeme tutarını ve kullanım koşullarını kabul
                  ediyorum.
                </FieldLabel>
              </Field>
              {message && (
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <Button
                disabled={
                  !accessAllowed ||
                  !accepted ||
                  pending ||
                  !price.active ||
                  !selected ||
                  !canPurchaseAddOn(selected, plan) ||
                  store?.owned.includes(selected)
                }
                onClick={() => transition(buy)}
              >
                {pending && <Spinner data-icon="inline-start" />}Güvenli ödemeye
                geç
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
