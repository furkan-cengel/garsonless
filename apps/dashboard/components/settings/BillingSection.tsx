'use client'

import { AddOnBilling } from './AddOnBilling'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  SubscriptionBillingAddress,
  SubscriptionBillingProfile,
  SubscriptionBillingSettings,
  SubscriptionBillingSettingsInvoice,
  SubscriptionBillingSettingsRefund,
} from '@garsonless/application/billing'
import {
  ADD_ON_DEFINITIONS,
  PLAN_DEFINITIONS,
  normalizeRestaurantPlan,
  type BillingInterval,
  type RestaurantAddOn,
} from '@garsonless/domain/entitlements'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import type { BillingPlanPrices, PaidBillingPlan } from '../../lib/billing/subscription-billing-request'
import { createIyzicoCheckoutDocument } from '../../lib/billing/iyzico-checkout-document'
import {
  isBillingCheckoutResultMessage,
  type BillingCheckoutPublicCode,
} from '../../lib/billing/subscription-billing-checkout-result'
import {
  cancelBillingSubscriptionAction,
  checkSubscriptionCheckoutAction,
  retryBillingInvoiceAction,
  saveBillingProfileAction,
  scheduleBillingPlanChangeAction,
  startBillingCheckoutAction,
  startBillingCardUpdateAction,
  undoBillingSubscriptionCancellationAction,
} from '../../lib/actions/billing'
import { I, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import styles from './BillingSection.module.css'
import { notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'
import { SCard, inputStyle } from './primitives'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Progress } from '../ui/progress'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
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

const EMPTY_ADDRESS: SubscriptionBillingAddress = {
  contactName: '', city: '', district: null, country: 'Türkiye', address: '', zipCode: null,
}

const EMPTY_PROFILE: SubscriptionBillingProfile = {
  legalName: '', taxOffice: '', name: '', surname: '', identityNumber: '', email: '', gsmNumber: '',
  billingAddress: { ...EMPTY_ADDRESS }, shippingAddress: { ...EMPTY_ADDRESS },
}

const PAID_PLANS: PaidBillingPlan[] = ['starter', 'plus', 'pro']

const STATUS_LABELS = {
  trial: 'Deneme', trial_expired: 'Deneme sona erdi', active: 'Aktif', past_due: 'Ödeme gecikti', grace_period: 'Ek süre',
  suspended: 'Askıya alındı', cancelled: 'İptal edildi', manual_hold: 'İncelemede',
  refund_cancel_pending: 'İptal ediliyor',
} as const

const INVOICE_LABELS = {
  draft: 'Taslak', open: 'Ödeme teyidi bekleniyor', paid: 'Ödendi', past_due: 'Ödeme gecikti',
  void: 'İptal', uncollectible: 'Tahsil edilemedi',
} as const

function money(minor: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(minor / 100)
}

function date(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function statusTone(status: string): 'positive' | 'warning' | 'critical' | 'neutral' {
  if (status === 'active' || status === 'paid') return 'positive'
  if (status === 'past_due' || status === 'grace_period' || status === 'open') return 'warning'
  if (status === 'trial_expired' || status === 'suspended' || status === 'refund_cancel_pending' || status === 'uncollectible') return 'critical'
  return 'neutral'
}

function failureMessage(result: { error: string; publicCode: string; referenceId?: string }): string {
  return `${result.error} (${result.publicCode}${result.referenceId ? ` · ${result.referenceId}` : ''})`
}

function Field({ label, value, onChange, type = 'text', placeholder, required = true }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
        style={inputStyle({ width: '100%', height: 36 })}
      />
    </label>
  )
}

function AddressFields({ title, value, onChange }: {
  title: string
  value: SubscriptionBillingAddress
  onChange: (value: SubscriptionBillingAddress) => void
}) {
  const set = (key: keyof SubscriptionBillingAddress, next: string) => onChange({
    ...value,
    [key]: key === 'district' || key === 'zipCode' ? next || null : next,
  })
  return (
    <fieldset style={{ margin: 0, padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
      <legend style={{ padding: '0 6px', fontSize: 12, fontWeight: 600 }}>{title}</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="İlgili kişi" value={value.contactName} onChange={(next) => set('contactName', next)} />
        <Field label="Şehir" value={value.city} onChange={(next) => set('city', next)} />
        <Field label="İlçe" value={value.district ?? ''} onChange={(next) => set('district', next)} required={false} />
        <Field label="Ülke" value={value.country} onChange={(next) => set('country', next)} />
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Adres" value={value.address} onChange={(next) => set('address', next)} />
        </div>
        <Field label="Posta kodu" value={value.zipCode ?? ''} onChange={(next) => set('zipCode', next)} required={false} />
      </div>
    </fieldset>
  )
}

const CHECKOUT_LOAD_TIMEOUT_MS = 15_000
const CHECKOUT_PROBE_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 45_000] as const
const CHECKOUT_SUCCESS_CLOSE_DELAY_MS = 1_200
const CHECKOUT_SUCCESS_REFRESH_RETRY_MS = 1_500
const CHECKOUT_ACTIVATION_TIMEOUT_MS = 45_000
const CARD_UPDATE_VERIFY_TIMEOUT_MS = 15_000

type CheckoutDialogState =
  | 'loading' | 'ready' | 'attempting' | 'verifying'
  | 'succeeded' | 'incomplete' | 'pending' | 'failed' | 'expired'

type CheckoutSession = {
  content: string
  plan: PaidBillingPlan
  addOns: RestaurantAddOn[]
  operationId: string
  expiresAt: string | null
}

type CardUpdateSession = {
  content: string
  operationId: string
  expiresAt: string | null
}

function HostedCheckoutDialog({ restaurantId, session, billing, onClose }: {
  restaurantId: string
  session: CheckoutSession
  billing: SubscriptionBillingSettings | null
  onClose: () => void
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const terminalRef = useRef(false)
  const sawIncompleteRef = useRef(false)
  const successRefreshStartedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const [attempt, setAttempt] = useState(0)
  const [dialogState, setDialogState] = useState<CheckoutDialogState>('loading')
  const [resultCode, setResultCode] = useState<BillingCheckoutPublicCode | null>(null)
  const [probeSequence, setProbeSequence] = useState(0)
  const [probeStep, setProbeStep] = useState(0)
  const [frameSession, setFrameSession] = useState<{ key: string; nonce: string } | null>(null)
  const subscription = billing?.subscription ?? null
  const invoice = billing?.invoices.find((item) => item.plan === session.plan) ?? billing?.invoices[0] ?? null
  const planActive = subscription?.status === 'active' && subscription.plan === session.plan
  const invoicePaid = invoice?.status === 'paid'
  const requestedAddOnsActive = session.addOns.every((addOn) => subscription?.activeAddOns.includes(addOn) === true)
  const activationComplete = dialogState === 'succeeded' && planActive && invoicePaid && requestedAddOnsActive
  const activationPending = dialogState === 'succeeded' && !activationComplete
  const dismissLocked = dialogState === 'verifying' || activationPending
  const activationProgress = activationComplete ? 100 : planActive || invoicePaid ? 84 : 64
  const activationTarget = [
    `${PLAN_DEFINITIONS[session.plan].label} planı`,
    ...session.addOns.map((addOn) => ADD_ON_DEFINITIONS[addOn].label),
  ].join(' + ')
  const resultVisible = dialogState === 'succeeded'
    || dialogState === 'pending'
    || dialogState === 'expired'
    || (dialogState === 'failed' && resultCode !== null)
  const frameHidden = resultVisible

  useEffect(() => {
    const nonce = crypto.randomUUID()
    terminalRef.current = false
    sawIncompleteRef.current = false
    successRefreshStartedRef.current = false
    setDialogState('loading')
    setResultCode(null)
    setProbeSequence(0)
    setProbeStep(0)
    setFrameSession({ key: nonce, nonce })
  }, [session.content, attempt])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const checkoutDocument = useMemo(() => frameSession
    ? createIyzicoCheckoutDocument(session.content, frameSession.nonce)
    : null, [session.content, frameSession])

  useEffect(() => {
    if (!frameSession) return
    const receiveCheckoutMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return
      const data = event.data as { type?: unknown; nonce?: unknown } | null
      if (data?.type === 'masabu:iyzico-mounted' && data.nonce === frameSession.nonce) {
        setDialogState((current) => current === 'loading' ? 'ready' : current)
        iframeRef.current?.contentWindow?.postMessage({
          type: 'masabu:iyzico-mounted-ack', nonce: frameSession.nonce,
        }, window.location.origin)
        return
      }
      if (data?.type === 'masabu:iyzico-attempting' && data.nonce === frameSession.nonce) {
        sawIncompleteRef.current = false
        setDialogState('attempting')
        setProbeSequence((current) => current + 1)
        return
      }
      if (data?.type === 'masabu:iyzico-navigating' && data.nonce === frameSession.nonce) {
        setDialogState('verifying')
        setProbeSequence((current) => current || 1)
        return
      }
      if (!isBillingCheckoutResultMessage(event.data)) return
      setResultCode(event.data.code ?? null)
      terminalRef.current = event.data.outcome !== 'incomplete'
      setDialogState(event.data.outcome)
    }
    window.addEventListener('message', receiveCheckoutMessage)
    const timeout = window.setTimeout(() => setDialogState((current) => (
      current === 'ready' || current === 'verifying' || resultVisible ? current : 'failed'
    )), CHECKOUT_LOAD_TIMEOUT_MS)
    return () => {
      window.removeEventListener('message', receiveCheckoutMessage)
      window.clearTimeout(timeout)
    }
  }, [frameSession, resultVisible])

  useEffect(() => {
    if (!probeSequence || terminalRef.current) return
    let cancelled = false
    const timers = CHECKOUT_PROBE_DELAYS_MS.map((delay, index) => window.setTimeout(async () => {
      if (cancelled || terminalRef.current) return
      setProbeStep(index + 1)
      const result = await checkSubscriptionCheckoutAction(restaurantId, session.operationId)
      if (cancelled || terminalRef.current) return
      if ('error' in result) {
        if (index === CHECKOUT_PROBE_DELAYS_MS.length - 1 && !sawIncompleteRef.current) {
          setDialogState('pending')
        }
        return
      }
      if (result.outcome === 'active') {
        terminalRef.current = true
        setDialogState('succeeded')
        return
      }
      if (result.outcome === 'expired') {
        terminalRef.current = true
        setDialogState('expired')
        router.refresh()
        return
      }
      if (result.outcome === 'incomplete') {
        sawIncompleteRef.current = true
        setDialogState('incomplete')
        return
      }
      if (index === CHECKOUT_PROBE_DELAYS_MS.length - 1 && !sawIncompleteRef.current) {
        setDialogState('pending')
      }
    }, delay))
    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [probeSequence, restaurantId, router, session.operationId])

  useEffect(() => {
    if (!planActive || terminalRef.current || probeSequence === 0) return
    terminalRef.current = true
    setDialogState('succeeded')
  }, [planActive, probeSequence])

  useEffect(() => {
    if (dialogState !== 'succeeded') return
    if (!successRefreshStartedRef.current) {
      successRefreshStartedRef.current = true
      router.refresh()
    }
    if (activationComplete) {
      const closeTimer = window.setTimeout(
        () => onCloseRef.current(),
        CHECKOUT_SUCCESS_CLOSE_DELAY_MS,
      )
      return () => window.clearTimeout(closeTimer)
    }
    const refreshTimer = window.setTimeout(
      () => router.refresh(),
      CHECKOUT_SUCCESS_REFRESH_RETRY_MS,
    )
    return () => window.clearTimeout(refreshTimer)
  }, [activationComplete, dialogState, router])

  useEffect(() => {
    if (!activationPending) return
    const timeout = window.setTimeout(() => {
      setDialogState('pending')
      router.refresh()
    }, CHECKOUT_ACTIVATION_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [activationPending, router])

  useEffect(() => {
    if (!session.expiresAt || terminalRef.current) return
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (remaining <= 0) {
      terminalRef.current = true
      setDialogState('expired')
      return
    }
    const timeout = window.setTimeout(() => {
      if (!terminalRef.current) {
        terminalRef.current = true
        setDialogState('expired')
      }
    }, Math.min(remaining, 2_147_483_647))
    return () => window.clearTimeout(timeout)
  }, [session.expiresAt])

  useEffect(() => {
    if (!resultVisible) return
    resultHeadingRef.current?.focus()
  }, [resultVisible])

  const resultTitle = dialogState === 'failed'
    ? 'Ödeme doğrulanamadı'
    : dialogState === 'expired'
      ? 'Ödeme oturumu sona erdi'
      : dialogState === 'pending'
        ? 'Sonuç henüz kesinleşmedi'
        : activationComplete
          ? `${PLAN_DEFINITIONS[session.plan].label} planınız aktif`
          : `${activationTarget} etkinleştiriliyor`
  const resultDescription = dialogState === 'failed'
    ? `Ödeme tamamlanmadı. Kartınızdan yeniden tahsilat başlatmadan önce faturalama ekranına dönün.${resultCode ? ` Destek kodu: ${resultCode}.` : ''}`
    : dialogState === 'expired'
      ? 'Bu form artık kullanılamaz. Faturalama ekranından yeni bir ödeme oturumu başlatabilirsiniz.'
      : dialogState === 'pending'
        ? 'İyzico sonucu güvenli biçimde tekrar kontrol edilecek. Şimdilik yeni bir ödeme başlatmayın.'
        : activationComplete
          ? 'Ödeme tamamlandı ve faturanız kaydedildi. Faturalama ekranına yönlendiriliyorsunuz.'
          : 'Ödemeniz alındı. Planınız ve ücretli özellikleriniz hesabınıza güvenli biçimde uygulanıyor.'

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !dismissLocked) onClose() }}>
      <DialogContent
        showCloseButton={false}
        aria-busy={dismissLocked}
        className="h-[min(760px,92dvh)] max-w-[min(720px,calc(100%-2rem))] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-[720px]"
      >
        <DialogHeader className="border-b px-4 py-3 pr-14">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><I.card size={17} /></div>
            <div className="min-w-0">
              <DialogTitle id="billing-checkout-title">{activationPending ? 'Abonelik aktivasyonu' : resultVisible ? 'Abonelik sonucu' : 'Güvenli ödeme'}</DialogTitle>
              <DialogDescription>Kart bilgileri İyzico’nun barındırdığı formda girilir; masabu kart verisini görmez.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {!dismissLocked && (
          <DialogClose
            render={<Button variant="outline" size="icon" className="absolute right-3 top-3" />}
            aria-label="Ödeme penceresini kapat"
          >
            <I.close />
          </DialogClose>
        )}
        <div className="relative min-h-0 bg-background">
          {!frameHidden && checkoutDocument && (
            <div className="flex size-full min-h-0 flex-col">
              {(dialogState === 'attempting' || dialogState === 'incomplete') && (
                <div className="p-3 pb-0">
                  <Alert>
                    <I.warn />
                    <AlertTitle>{dialogState === 'incomplete' ? 'İşlem tamamlanmadı' : 'Kart bilgileriniz kontrol ediliyor'}</AlertTitle>
                    <AlertDescription>
                      {dialogState === 'incomplete'
                        ? 'İyzico mesajını kontrol edip aynı formda düzeltme yaparak yeniden deneyin.'
                        : 'Form açık kalır; doğrulama hatası varsa aşağıda gösterilir.'}
                    </AlertDescription>
                    <Progress value={(probeStep / CHECKOUT_PROBE_DELAYS_MS.length) * 100} className="col-span-full mt-2" />
                  </Alert>
                </div>
              )}
              <iframe
                key={frameSession?.key}
                ref={iframeRef}
                title="İyzico abonelik ödeme formu"
                srcDoc={checkoutDocument}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                referrerPolicy="no-referrer"
                onError={() => setDialogState('failed')}
                className="min-h-0 flex-1 border-0 bg-background"
              />
            </div>
          )}
          {(dialogState === 'loading' || dialogState === 'verifying') && (
            <div role="status" aria-live="polite" className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
              <div className="grid max-w-sm justify-items-center gap-3 text-muted-foreground">
                <Spinner />
                <strong className="text-foreground">{dialogState === 'verifying' ? 'Ödemeniz doğrulanıyor…' : 'Güvenli ödeme formu yükleniyor…'}</strong>
                {dialogState === 'verifying' && <span>Sonuç alınana kadar lütfen bu pencereyi kapatmayın.</span>}
              </div>
            </div>
          )}
          {dialogState === 'failed' && !resultVisible && (
            <div role="alert" className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
              <div className="grid max-w-sm justify-items-center gap-3">
                <strong>Ödeme formu yüklenemedi</strong>
                <span className="text-muted-foreground">Bağlantıyı kontrol edip yeniden deneyin. Ödeme işlemi başlatılmadı.</span>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => setAttempt((current) => current + 1)}><I.refresh data-icon="inline-start" />Yeniden dene</Button>
                  <Button type="button" variant="outline" onClick={onClose}>Kapat</Button>
                </div>
              </div>
            </div>
          )}
          {resultVisible && (
            <div role={dialogState === 'failed' ? 'alert' : 'status'} aria-live="polite" className="absolute inset-0 grid place-items-center overflow-auto bg-background p-6 text-center">
              <div className="grid max-w-md justify-items-center gap-4">
                <div className="grid size-14 place-items-center rounded-full bg-muted text-foreground">
                  {dialogState === 'pending'
                    ? <Spinner />
                    : dialogState === 'succeeded'
                      ? activationPending ? <Spinner className="size-6" /> : <I.check size={26} />
                      : <I.warn size={24} />}
                </div>
                <h2 ref={resultHeadingRef} tabIndex={-1} className="text-xl font-semibold outline-none">{resultTitle}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{resultDescription}</p>
                {dialogState === 'succeeded' && (
                  <div className="flex flex-wrap justify-center gap-2" aria-label="Aktivasyon durumu">
                    <Badge variant="positive"><I.check />Ödeme alındı</Badge>
                    <Badge variant={activationComplete ? 'positive' : 'info'}>
                      {activationPending ? <Spinner /> : <I.check />}
                      {activationComplete ? 'Plan ve özellikler aktif' : 'Plan ve özellikler hazırlanıyor'}
                    </Badge>
                  </div>
                )}
                {activationPending && (
                  <Alert role="status" className="w-full">
                    <Spinner />
                    <AlertTitle>Hesabınız güncelleniyor</AlertTitle>
                    <AlertDescription>Bu işlem genellikle birkaç saniye sürer. Tamamlandığında ekran otomatik yenilenecek.</AlertDescription>
                    <Progress
                      value={activationProgress}
                      aria-label="Abonelik aktivasyon ilerlemesi"
                      className="col-span-full mt-3"
                    />
                  </Alert>
                )}
                {planActive && subscription?.currentPeriodEnd && (
                  <div className="w-full rounded-lg border bg-muted/40 p-4 text-left text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>Plan</span><strong>{PLAN_DEFINITIONS[session.plan].label}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Dönem sonu</span><strong>{date(subscription.currentPeriodEnd)}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>Fatura</span><Tag tone={invoicePaid ? 'positive' : 'warning'}>{invoicePaid ? 'Ödendi' : 'Teyit bekleniyor'}</Tag>
                    </div>
                  </div>
                )}
                {activationPending
                  ? (
                    <Button type="button" disabled>
                      <Spinner data-icon="inline-start" />Etkinleştirme tamamlanıyor…
                    </Button>
                  )
                  : (
                    <Button type="button" onClick={onClose}>Faturalamaya dön</Button>
                  )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HostedCardUpdateDialog({ session, onClose }: {
  session: CardUpdateSession
  onClose: () => void
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [state, setState] = useState<CheckoutDialogState>('loading')
  const [resultCode, setResultCode] = useState<BillingCheckoutPublicCode | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [frameSession, setFrameSession] = useState<{ key: string; nonce: string } | null>(null)
  const resultVisible = ['succeeded', 'pending', 'expired'].includes(state)
    || (state === 'failed' && resultCode !== null)

  useEffect(() => {
    const nonce = crypto.randomUUID()
    setState('loading')
    setResultCode(null)
    setFrameSession({ key: nonce, nonce })
  }, [session.content, attempt])

  const checkoutDocument = useMemo(() => frameSession
    ? createIyzicoCheckoutDocument(session.content, frameSession.nonce)
    : null, [session.content, frameSession])

  useEffect(() => {
    if (!frameSession) return
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return
      const data = event.data as { type?: unknown; nonce?: unknown } | null
      if (data?.type === 'masabu:iyzico-mounted' && data.nonce === frameSession.nonce) {
        setState('ready')
        iframeRef.current?.contentWindow?.postMessage({
          type: 'masabu:iyzico-mounted-ack', nonce: frameSession.nonce,
        }, window.location.origin)
        return
      }
      if (data?.type === 'masabu:iyzico-attempting' && data.nonce === frameSession.nonce) {
        setState('attempting')
        return
      }
      if (data?.type === 'masabu:iyzico-navigating' && data.nonce === frameSession.nonce) {
        setState('verifying')
        return
      }
      if (!isBillingCheckoutResultMessage(event.data)) return
      setResultCode(event.data.code ?? null)
      setState(event.data.outcome)
      if (event.data.outcome === 'succeeded') router.refresh()
    }
    window.addEventListener('message', receive)
    const timeout = window.setTimeout(() => {
      setState((current) => current === 'loading' ? 'failed' : current)
    }, CHECKOUT_LOAD_TIMEOUT_MS)
    return () => {
      window.removeEventListener('message', receive)
      window.clearTimeout(timeout)
    }
  }, [frameSession, router])

  useEffect(() => {
    if (!session.expiresAt || resultVisible) return
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (remaining <= 0) {
      setState('expired')
      return
    }
    const timeout = window.setTimeout(() => setState('expired'), Math.min(remaining, 2_147_483_647))
    return () => window.clearTimeout(timeout)
  }, [resultVisible, session.expiresAt])

  useEffect(() => {
    if (state !== 'verifying') return
    const timeout = window.setTimeout(() => {
      setResultCode('MAS-PAY-409')
      setState('pending')
    }, CARD_UPDATE_VERIFY_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [state])

  const title = state === 'succeeded' ? 'Kartınız güncellendi'
    : state === 'pending' ? 'Sonuç kontrol ediliyor'
      : state === 'expired' ? 'Kart güncelleme oturumu sona erdi'
        : 'Kart güncelleme tamamlanamadı'
  const description = state === 'succeeded'
    ? 'Yeni kartınız sonraki abonelik tahsilatlarında İyzico tarafından kullanılacak.'
    : state === 'pending'
      ? 'Sonuç uzlaştırılıyor. Aynı işlemi tekrar başlatmayın.'
      : state === 'expired'
        ? 'Yeni bir güvenli kart güncelleme oturumu başlatabilirsiniz.'
        : `Kart güncelleme doğrulanamadı.${resultCode ? ` Destek kodu: ${resultCode}.` : ''}`

  return (
    <Dialog open onOpenChange={(open) => { if (!open && state !== 'verifying') onClose() }}>
      <DialogContent showCloseButton={false} className="h-[min(760px,92dvh)] max-w-[min(720px,calc(100%-2rem))] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b px-4 py-3 pr-14">
          <DialogTitle>Güvenli kart güncelleme</DialogTitle>
          <DialogDescription>Kart bilgileri yalnız İyzico formuna girilir; masabu kart numarasını görmez veya saklamaz.</DialogDescription>
        </DialogHeader>
        <DialogClose render={<Button variant="outline" size="icon" className="absolute right-3 top-3" />} aria-label="Kart güncelleme penceresini kapat" disabled={state === 'verifying'}>
          <I.close />
        </DialogClose>
        <div className="relative min-h-0 bg-background">
          {!resultVisible && checkoutDocument && (
            <iframe
              key={frameSession?.key}
              ref={iframeRef}
              title="İyzico abonelik kart güncelleme formu"
              srcDoc={checkoutDocument}
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
              referrerPolicy="no-referrer"
              onError={() => setState('failed')}
              className="size-full min-h-0 border-0 bg-background"
            />
          )}
          {(state === 'loading' || state === 'verifying') && (
            <div role="status" className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
              <div className="grid justify-items-center gap-3"><Spinner /><strong>{state === 'verifying' ? 'Kart güncellemesi doğrulanıyor…' : 'Güvenli form yükleniyor…'}</strong></div>
            </div>
          )}
          {state === 'failed' && !resultVisible && (
            <div role="alert" className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
              <div className="grid justify-items-center gap-3">
                <strong>Form yüklenemedi</strong>
                <span className="text-sm text-muted-foreground">Kart bilgileriniz alınmadı. Bağlantıyı kontrol edip yeniden deneyin.</span>
                <div className="flex gap-2"><Button onClick={() => setAttempt((value) => value + 1)}>Yeniden dene</Button><Button variant="outline" onClick={onClose}>Kapat</Button></div>
              </div>
            </div>
          )}
          {resultVisible && (
            <div role={state === 'failed' ? 'alert' : 'status'} className="absolute inset-0 grid place-items-center overflow-auto bg-background p-6 text-center">
              <div className="grid max-w-md justify-items-center gap-4">
                <div className="grid size-14 place-items-center rounded-full bg-muted">{state === 'succeeded' ? <I.check size={26} /> : <I.warn size={24} />}</div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                <Button type="button" onClick={onClose}>Faturalamaya dön</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InvoiceRow({ restaurantId, invoice }: { restaurantId: string; invoice: SubscriptionBillingSettingsInvoice }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const addOnLabels = invoice.addOns.map((addOn) => ADD_ON_DEFINITIONS[addOn].label)
  const tone = statusTone(invoice.status)
  function retry() {
    setMessage('')
    startTransition(async () => {
      const result = await retryBillingInvoiceAction(restaurantId, {
        invoiceId: invoice.id, requestId: crypto.randomUUID(),
      })
      if ('error' in result) return setMessage(failureMessage(result))
      setMessage(result.duplicate ? 'Bu yeniden deneme daha önce gönderildi.' : 'Tahsilat yeniden denemesi İyzico’ya iletildi.')
      router.refresh()
    })
  }
  const documentControl = invoice.fiscalDocumentStatus === 'ready' && invoice.canDownload
    ? (
      <Button
        variant="outline"
        size="sm"
        render={<a href={`/api/restaurants/${encodeURIComponent(restaurantId)}/billing/invoices/${encodeURIComponent(invoice.id)}/document`} />}
        aria-label={`${invoice.fiscalDocumentType === 'e_fatura' ? 'e-Fatura' : 'e-Arşiv'} PDF indir`}
      >
        <I.download data-icon="inline-start" />PDF indir
      </Button>
      )
    : invoice.fiscalDocumentStatus === 'preparing'
      ? <Badge variant="info"><Spinner data-icon="inline-start" aria-hidden="true" />Fatura hazırlanıyor</Badge>
      : invoice.fiscalDocumentStatus === 'profile_required'
        ? <Badge variant="warning" render={<a href="#billing-profile" />}>Fatura profili gerekli</Badge>
        : invoice.fiscalDocumentStatus === 'failed'
          ? <Badge variant="destructive">Fatura oluşturulamadı</Badge>
          : <span className="text-xs text-muted-foreground">Henüz kullanılamıyor</span>
  return (
    <div className={styles.invoiceRow}>
      <div className={styles.invoiceDetails}>
        <div className={styles.invoiceTitle}>{PLAN_DEFINITIONS[invoice.plan].label} · {invoice.billingInterval === 'annual' ? 'Yıllık' : 'Aylık'}</div>
        {addOnLabels.length > 0 && <div className={styles.invoiceMeta}>{addOnLabels.join(', ')}</div>}
        <div className={styles.invoicePeriod}>{date(invoice.periodStart)} – {date(invoice.periodEnd)}</div>
        <div className={styles.invoiceMeta}>
          {invoice.status === 'open' ? 'İyzico bildirimi bekleniyor · ' : 'Vade '}{date(invoice.dueAt)}
        </div>
        {message && <div role="status" style={{ fontSize: 11, color: message.includes('MAS-') ? 'var(--critical)' : 'var(--positive)', marginTop: 4 }}>{message}</div>}
      </div>
      <div className={styles.invoiceAmount}>{money(invoice.amountDueMinor)}</div>
      <div className={styles.invoiceActions}>
        <Badge variant={tone === 'critical' ? 'destructive' : tone === 'neutral' ? 'secondary' : tone}>{INVOICE_LABELS[invoice.status]}</Badge>
        {invoice.canRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={retry} disabled={pending} aria-busy={pending}>{pending ? 'Gönderiliyor…' : 'Tekrar dene'}</Button>
        ) : documentControl}
      </div>
    </div>
  )
}

function RefundRow({ refund }: { refund: SubscriptionBillingSettingsRefund }) {
  const status = refund.status === 'succeeded' ? 'Tamamlandı'
    : refund.status === 'failed' ? 'Tamamlanamadı'
      : refund.status === 'requires_reconciliation' ? 'Kontrol ediliyor' : 'İşleniyor'
  const tone = refund.status === 'succeeded' ? 'positive'
    : refund.status === 'failed' ? 'critical' : 'warning'
  const accessLabel = refund.accessAction === 'keep' ? 'Erişim korunuyor'
    : refund.cancellationStatus === 'applied' ? 'Abonelik iptal edildi'
      : refund.cancellationStatus === 'requires_reconciliation' ? 'Manuel kontrol gerekiyor'
        : refund.status === 'succeeded' ? 'Abonelik kapatılıyor' : 'İade sonucu bekleniyor'
  return <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
    <div><strong style={{ fontSize: 13 }}>{refund.kind === 'same_day_cancel' ? 'Aynı gün tam iptal' : refund.scope === 'full' ? 'Tam iade' : 'Kısmi iade'}</strong><div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{new Date(refund.requestedAt).toLocaleString('tr-TR')} · Fatura …{refund.invoiceId.slice(-8)}</div><div style={{ fontSize: 11.5, color: refund.cancellationStatus === 'requires_reconciliation' ? 'var(--critical)' : 'var(--text-2)', marginTop: 4 }}>{accessLabel}</div></div>
    <div style={{ textAlign: 'right' }}><strong>{money(refund.amountMinor)}</strong><div style={{ marginTop: 4 }}><Tag tone={tone}>{status}</Tag></div></div>
  </div>
}

export default function BillingSection({
  restaurantId,
  restaurantPlan,
  billing,
  loadError,
  planPrices,
  checkoutState,
}: {
  restaurantId: string
  restaurantPlan: string
  billing: SubscriptionBillingSettings | null
  loadError: string | null
  planPrices: BillingPlanPrices
  checkoutState: 'success' | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPlan = normalizeRestaurantPlan(restaurantPlan)
  const requestedPlan = searchParams.get('plan')
  const requestedInterval = searchParams.get('interval')
  const initialPlan = PAID_PLANS.includes(requestedPlan as PaidBillingPlan)
    ? requestedPlan as PaidBillingPlan
    : currentPlan === 'business' ? 'pro' : currentPlan
  const initialInterval: BillingInterval = requestedInterval === 'annual' ? 'annual' : 'monthly'
  const [profile, setProfile] = useState<SubscriptionBillingProfile>(billing?.profile ?? EMPTY_PROFILE)
  const [shippingSame, setShippingSame] = useState(
    billing?.profile ? JSON.stringify(billing.profile.billingAddress) === JSON.stringify(billing.profile.shippingAddress) : true,
  )
  const [selectedPlan, setSelectedPlan] = useState<PaidBillingPlan>(initialPlan)
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(initialInterval)
  const [feedback, setFeedback] = useState(checkoutState === 'success' ? 'Abonelik bilgileri doğrulandı. Ödeme sonucu işlenirken durum otomatik güncellenecek.' : '')
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null)
  const [cardUpdateSession, setCardUpdateSession] = useState<CardUpdateSession | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [planChangeTarget, setPlanChangeTarget] = useState<{
    plan: PaidBillingPlan
    addOns: RestaurantAddOn[]
  } | null>(null)
  const [showPlanComparison, setShowPlanComparison] = useState(false)
  const [cancelPassword, setCancelPassword] = useState('')
  const [checkoutTermsAccepted, setCheckoutTermsAccepted] = useState(false)
  const [profilePending, startProfileTransition] = useTransition()
  const [checkoutPending, startCheckoutTransition] = useTransition()
  const [cardUpdatePending, startCardUpdateTransition] = useTransition()
  const [planChangePending, startPlanChangeTransition] = useTransition()
  const [cancelPending, startCancelTransition] = useTransition()
  const pending = profilePending || checkoutPending || cardUpdatePending || planChangePending || cancelPending
  const effectiveProfile = useMemo(() => shippingSame
    ? { ...profile, shippingAddress: { ...profile.billingAddress } }
    : profile, [profile, shippingSame])
  const profileSnapshotRef = useRef(effectiveProfile)
  const profileDirty = JSON.stringify(effectiveProfile) !== JSON.stringify(profileSnapshotRef.current)
  const subscription = billing?.subscription ?? null
  const currentSelfServePlan = subscription && PAID_PLANS.includes(subscription.plan as PaidBillingPlan)
    ? subscription.plan as PaidBillingPlan
    : null
  const latestInvoice = billing?.invoices[0] ?? null
  const canStartNewCheckout = !subscription || ['trial', 'trial_expired', 'cancelled'].includes(subscription.status)
  const checkoutAvailable = planPrices.checkoutAvailable
  const hasPreparingInvoice = billing?.invoices.some((invoice) =>
    invoice.status === 'paid' && invoice.fiscalDocumentStatus === 'preparing') === true
  const invoicePollingStartedAtRef = useRef<number | null>(null)
  const [invoicePollingTimedOut, setInvoicePollingTimedOut] = useState(false)
  useSettingsDirtyState('billing:profile', profileDirty)

  useEffect(() => {
    if (!hasPreparingInvoice) {
      invoicePollingStartedAtRef.current = null
      setInvoicePollingTimedOut(false)
      return
    }
    const startedAt = invoicePollingStartedAtRef.current ?? Date.now()
    invoicePollingStartedAtRef.current = startedAt
    const remainingMs = 120_000 - (Date.now() - startedAt)
    if (remainingMs <= 0) {
      setInvoicePollingTimedOut(true)
      return
    }
    const refreshTimer = window.setInterval(() => router.refresh(), 5_000)
    const stopTimer = window.setTimeout(() => {
      window.clearInterval(refreshTimer)
      setInvoicePollingTimedOut(true)
    }, remainingMs)
    return () => {
      window.clearInterval(refreshTimer)
      window.clearTimeout(stopTimer)
    }
  }, [hasPreparingInvoice, router])

  const setProfileValue = (key: keyof Omit<SubscriptionBillingProfile, 'billingAddress' | 'shippingAddress'>, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function saveProfile() {
    setFeedback('')
    startProfileTransition(async () => {
      const result = await saveBillingProfileAction(restaurantId, effectiveProfile)
      if ('error' in result) return setFeedback(failureMessage(result))
      profileSnapshotRef.current = effectiveProfile
      setFeedback('Fatura profili kaydedildi.')
      notifySettingsSaved('billing:profile')
      router.refresh()
    })
  }

  function startCheckout() {
    if (!checkoutAvailable) {
      setFeedback('Güvenli ödeme altyapısı henüz etkin değil. Liste fiyatları güncel; satın alma açıldığında buradan devam edebilirsiniz.')
      return
    }
    if (!canStartNewCheckout) {
      setFeedback('Mevcut abonelikte plan değişikliği yeni ödeme adımıyla yapılamaz. Destek ekibiyle iletişime geçin.')
      return
    }
    setFeedback('')
    startCheckoutTransition(async () => {
      const result = await startBillingCheckoutAction(restaurantId, {
        plan: selectedPlan, interval: selectedInterval, profile: effectiveProfile,
        addOns: [],
        requestId: crypto.randomUUID(), checkoutTermsAccepted, legalDocumentVersion: LEGAL_DOCUMENT_VERSION,
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      notifySettingsSaved()
      if (result.checkoutContent) setCheckoutSession({
        content: result.checkoutContent,
        plan: selectedPlan,
        addOns: [],
        operationId: result.operationId,
        expiresAt: result.expiresAt,
      })
      else setFeedback('Bu ödeme adımı daha önce başlatıldı. Sonucu görmek için sayfayı yenileyin.')
    })
  }

  function cancelSubscription() {
    setFeedback('')
    startCancelTransition(async () => {
      const result = await cancelBillingSubscriptionAction(restaurantId, {
        requestId: crypto.randomUUID(),
        currentPassword: cancelPassword,
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      setShowCancel(false)
      setCancelPassword('')
      setFeedback(`İptal ${date(result.effectiveAt)} dönem sonuna planlandı. Bu tarihe kadar planınız ve özellikleriniz aktif kalır.`)
      router.refresh()
    })
  }

  function undoCancellation() {
    if (!subscription?.cancellationRequestId || subscription.cancellationStatus !== 'scheduled') return
    setFeedback('')
    startCancelTransition(async () => {
      const result = await undoBillingSubscriptionCancellationAction(restaurantId, {
        requestId: crypto.randomUUID(),
        cancellationRequestId: subscription.cancellationRequestId,
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      setFeedback('Dönem sonu iptal talebi geri alındı. Aboneliğiniz yenilenmeye devam edecek.')
      router.refresh()
    })
  }

  function startCardUpdate() {
    setFeedback('')
    startCardUpdateTransition(async () => {
      const result = await startBillingCardUpdateAction(restaurantId, {
        requestId: crypto.randomUUID(),
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      if (!result.checkoutContent) {
        setFeedback(result.duplicate
          ? 'Bu kart güncelleme işlemi daha önce tamamlandı.'
          : 'Başlatılmış kart güncelleme işleminin sonucunu bekleyin.')
        return
      }
      setCardUpdateSession({
        content: result.checkoutContent,
        operationId: result.operationId,
        expiresAt: result.expiresAt,
      })
    })
  }

  function schedulePlanChange() {
    if (!planChangeTarget || !subscription) return
    setFeedback('')
    startPlanChangeTransition(async () => {
      const result = await scheduleBillingPlanChangeAction(restaurantId, {
        requestId: crypto.randomUUID(),
        toPlan: planChangeTarget.plan,
        billingInterval: subscription.billingInterval,
        addOns: planChangeTarget.addOns,
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      setPlanChangeTarget(null)
      const targetLabel = `${PLAN_DEFINITIONS[planChangeTarget.plan].label}${planChangeTarget.addOns.length ? ` + ${ADD_ON_DEFINITIONS[planChangeTarget.addOns[0]!].label}` : ''}`
      setFeedback(`${targetLabel} değişikliği ${date(result.effectiveAt)} döneminde, başarılı yenileme ödemesinden sonra uygulanacak.`)
      router.refresh()
    })
  }

  if (loadError) {
    return (
      <div role="alert" style={{ padding: 18, border: '1px solid var(--critical-bg)', borderLeft: '3px solid var(--critical)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Faturalama bilgileri yüklenemedi</div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, margin: '6px 0 14px' }}>Diğer ayarlarınız etkilenmedi. Biraz sonra sayfayı yenileyin; sorun sürerse destek kodu MAS-SVC-503 ile bize ulaşın.</p>
        <button type="button" onClick={() => router.refresh()} style={btnGhost()}><I.refresh size={13} />Yeniden dene</button>
      </div>
    )
  }

  return (
    <>
      {checkoutSession && (
        <HostedCheckoutDialog
          restaurantId={restaurantId}
          session={checkoutSession}
          billing={billing}
          onClose={() => setCheckoutSession(null)}
        />
      )}
      {cardUpdateSession && (
        <HostedCardUpdateDialog
          session={cardUpdateSession}
          onClose={() => setCardUpdateSession(null)}
        />
      )}

      <AddOnBilling profileSummary={[effectiveProfile.legalName, effectiveProfile.identityNumber, effectiveProfile.taxOffice, effectiveProfile.billingAddress.address, effectiveProfile.billingAddress.city].filter(Boolean).join(' · ') || 'Önce fatura bilgilerini doldur.'} restaurantId={restaurantId} plan={currentPlan} accessAllowed={Boolean(subscription && (['active','past_due','grace_period'].includes(subscription.status) || (subscription.status === 'trial' && subscription.trialEndsAt && Date.parse(subscription.trialEndsAt) > Date.now())))} saveProfile={async () => { const result = await saveBillingProfileAction(restaurantId, effectiveProfile); return 'error' in result ? { error: result.error } : {} }} />
      <div className={styles.subscriptionSummary}>
        <div className={styles.summaryLayout}>
          <div className={styles.planMonogram}>{PLAN_DEFINITIONS[currentPlan].label.slice(0, 3).toUpperCase()}</div>
          <div className={styles.planInfo}>
            <div className={styles.planHeading}>
              <strong>{PLAN_DEFINITIONS[currentPlan].label} planı</strong>
              <Tag tone={subscription ? statusTone(subscription.status) : 'neutral'}>{subscription ? STATUS_LABELS[subscription.status] : 'Abonelik yok'}</Tag>
              {subscription?.activeAddOns.map((addOn) => (
                <Tag key={addOn} tone="positive">{ADD_ON_DEFINITIONS[addOn].label} aktif</Tag>
              ))}
              {subscription?.scheduledPlan && <Tag tone="warning">{PLAN_DEFINITIONS[subscription.scheduledPlan].label} planlandı</Tag>}
              {subscription?.scheduledAddOns.map((addOn) => (
                <Tag key={`scheduled-${addOn}`} tone="warning">{ADD_ON_DEFINITIONS[addOn].label} planlandı</Tag>
              ))}
              {subscription?.cancelAtPeriodEnd && subscription.cancellationEffectiveAt && (
                <Tag tone="warning">İptal {date(subscription.cancellationEffectiveAt)} için planlandı</Tag>
              )}
            </div>
            <div className={styles.planPeriod}>
              {subscription?.currentPeriodEnd ? `${subscription.billingInterval === 'annual' ? 'Yıllık' : 'Aylık'} dönem ${date(subscription.currentPeriodEnd)} tarihinde sona erer.` : 'Ücretli bir plan başlattığınızda dönem ve ödeme durumu burada görünür.'}
            </div>
          </div>
          {subscription && !['cancelled', 'refund_cancel_pending'].includes(subscription.status) && (
            <div className={styles.summaryActions}>
              <button type="button" onClick={startCardUpdate} disabled={pending} style={btnGhost({ opacity: pending ? .55 : 1 })}><I.card size={13} />{cardUpdatePending ? 'Hazırlanıyor…' : 'Kartı güncelle'}</button>
              {subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={undoCancellation}
                  disabled={pending || subscription.cancellationStatus !== 'scheduled' || !subscription.cancellationRequestId}
                  style={btnGhost({ opacity: pending || subscription.cancellationStatus !== 'scheduled' ? .55 : 1 })}
                >
                  {cancelPending ? 'Geri alınıyor…' : subscription.cancellationStatus === 'scheduled' ? 'İptal talebini geri al' : 'İptal işleniyor'}
                </button>
              ) : (
                <button type="button" onClick={() => { setCancelPassword(''); setShowCancel(true) }} disabled={pending} style={btnGhost({ color: 'var(--critical)', borderColor: 'var(--critical-bg)', opacity: pending ? .55 : 1 })}>Aboneliği iptal et</button>
              )}
            </div>
          )}
        </div>
      </div>

      {(subscription?.status === 'past_due' || subscription?.status === 'grace_period') && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>Ödeme erişimi uyarılı durumda.</strong> Gerekirse önce “Kartı güncelle”, ardından geciken faturadaki “Tekrar dene” aksiyonunu kullanın{subscription.graceEndsAt ? `; ek süre ${date(subscription.graceEndsAt)} tarihinde biter` : ''}.
        </div>
      )}
      {(subscription?.status === 'trial_expired' || subscription?.status === 'suspended' || subscription?.status === 'cancelled' || subscription?.status === 'manual_hold') && (
        <div role="alert" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>Operasyonel değişiklikler ve yayın kilitli.</strong> Verileriniz korunur; profil, çalışma alanı, güvenlik, gizlilik/dışa aktarma ve faturalama araçlarını kullanmaya devam edebilirsiniz.
        </div>
      )}
      {subscription?.status === 'refund_cancel_pending' && (
        <Alert variant="destructive" style={{ marginBottom: 16 }}>
          <I.warn size={16} />
          <AlertTitle>Abonelik iptal ediliyor</AlertTitle>
          <AlertDescription>İade tamamlandı ve ücretli özellikler kilitlendi. İyzico’daki tüm abonelik kayıtları doğrulanıyor; bu sırada yeni ödeme veya plan değişikliği başlatmayın. Verileriniz ve faturalama araçlarınız erişilebilir kalır.</AlertDescription>
        </Alert>
      )}

      {(billing?.attention.reconciliationCount ?? 0) > 0 && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5, display: 'flex', gap: 9 }}>
          <I.warn size={16} /> <span><strong>Ödeme durumu kontrol ediliyor.</strong> Sonucu kesinleşmemiş {billing?.attention.reconciliationCount} işlem var; bu sırada aynı işlemi tekrar başlatmayın.</span>
        </div>
      )}
      {billing?.attention.hasPendingCheckout && canStartNewCheckout && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--info-bg)', color: 'var(--info)', fontSize: 12.5 }}>Başlatılmış bir ödeme adımı callback sonucunu bekliyor.</div>
      )}
      {subscription?.status === 'active' && latestInvoice?.status === 'open' && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--info-bg)', color: 'var(--info)', fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>Planınız aktif.</strong> İlk fatura için İyzico teyidi bekleniyor; tekrar ödeme yapmayın. Durum güvenli bildirim geldiğinde otomatik güncellenecek.
        </div>
      )}

      {canStartNewCheckout ? (
        <SCard title="Plan seçimi" subtitle="Kart bilgileri yalnız İyzico’nun güvenli ödeme formunda alınır">
        <div role="group" aria-label="Fatura dönemi" style={{ padding: '16px 16px 0', display: 'flex', gap: 6 }}>
          {(['monthly', 'annual'] as const).map((interval) => (
            <button key={interval} type="button" aria-pressed={selectedInterval === interval} onClick={() => setSelectedInterval(interval)} style={selectedInterval === interval ? btnPrimary() : btnGhost()}>
              {interval === 'monthly' ? 'Aylık' : 'Yıllık · %20 indirim'}
            </button>
          ))}
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {PAID_PLANS.map((plan) => {
            const selected = selectedPlan === plan
            return (
              <button key={plan} type="button" aria-pressed={selected} disabled={!canStartNewCheckout} onClick={() => { setSelectedPlan(plan) }} style={{ minWidth: 0, padding: 14, borderRadius: 10, border: selected ? '1.5px solid var(--text)' : '1px solid var(--border)', background: selected ? 'var(--surface-inset)' : 'var(--surface)', textAlign: 'left', cursor: canStartNewCheckout ? 'pointer' : 'not-allowed', opacity: canStartNewCheckout ? 1 : .62 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{PLAN_DEFINITIONS[plan].label}</div>
                <div style={{ fontSize: 16, fontWeight: 750, marginTop: 8, overflowWrap: 'anywhere' }}>{money(planPrices[plan][selectedInterval])}{selectedInterval === 'monthly' ? '/ay' : '/yıl'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{PLAN_DEFINITIONS[plan].description}</div>
              </button>
            )
          })}
        </div>
        </SCard>
      ) : (
        <Collapsible open={showPlanComparison} onOpenChange={setShowPlanComparison}>
          <SCard title="Plan yönetimi" subtitle="Aynı fatura dönemindeki değişiklik bir sonraki başarılı yenilemede uygulanır">
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13.5 }}>{PLAN_DEFINITIONS[currentPlan].label} planını kullanıyorsunuz</strong>
                <span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: 'var(--text-3)' }}>
                  {subscription?.scheduledPlan
                    ? `${PLAN_DEFINITIONS[subscription.scheduledPlan].label}${subscription.scheduledAddOns.length ? ` + ${subscription.scheduledAddOns.map((addOn) => ADD_ON_DEFINITIONS[addOn].label).join(', ')}` : ''} değişikliği planlandı; başarılı dönem ödemesinden sonra özellikler güncellenecek.`
                    : subscription?.activeAddOns.length
                      ? `Aktif: ${subscription.activeAddOns.map((addOn) => ADD_ON_DEFINITIONS[addOn].label).join(', ')}. Paket değişikliği dönem sonunda uygulanır. Yeni eklentiler tek seferlik satın alınır.`
                      : 'Hemen ücret alınmaz; mevcut planınız dönem sonuna kadar değişmez.'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <CollapsibleTrigger render={<Button variant="outline" />}>
                  <I.chevDown data-icon="inline-start" />
                  {showPlanComparison ? 'Planları gizle' : 'Diğer planları görüntüle'}
                </CollapsibleTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {PAID_PLANS.map((plan) => {
                  const isCurrent = plan === currentSelfServePlan
                  const isScheduled = plan === subscription?.scheduledPlan
                  const targetAddOns: RestaurantAddOn[] = []
                  const canSchedule = subscription?.status === 'active'
                    && currentSelfServePlan !== null
                    && !subscription.cancelAtPeriodEnd
                    && !subscription.scheduledPlan
                    && !isCurrent
                  return (
                  <div key={plan} style={{ minWidth: 0, padding: 14, borderRadius: 10, border: isCurrent ? '1.5px solid var(--text)' : '1px solid var(--border)', background: isCurrent ? 'var(--surface-inset)' : 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 13.5 }}>{PLAN_DEFINITIONS[plan].label}</strong>
                      {isCurrent && <Tag tone="positive">Mevcut</Tag>}
                      {isScheduled && <Tag tone="warning">Planlandı</Tag>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 750, marginTop: 8, overflowWrap: 'anywhere' }}>{money(planPrices[plan][subscription?.billingInterval ?? 'monthly'])}{subscription?.billingInterval === 'annual' ? '/yıl' : '/ay'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{PLAN_DEFINITIONS[plan].description}</div>
                    {!isCurrent && (
                      <button type="button" disabled={!canSchedule || pending} onClick={() => setPlanChangeTarget({ plan, addOns: targetAddOns })} style={{ ...btnGhost(), width: '100%', justifyContent: 'center', marginTop: 12, opacity: canSchedule && !pending ? 1 : .55 }}>
                        {isScheduled ? 'Geçiş planlandı' : `${PLAN_DEFINITIONS[plan].label} planına geç`}
                      </button>
                    )}
                  </div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </SCard>
        </Collapsible>
      )}

      <div id="billing-profile">
        <SCard title="Fatura profili" subtitle="İyzico abonelik işlemi için zorunlu yasal ve iletişim bilgileri" style={{ marginTop: 16 }}>
          <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Yasal unvan" value={profile.legalName} onChange={(value) => setProfileValue('legalName', value)} /></div>
            <Field label="Ad" value={profile.name} onChange={(value) => setProfileValue('name', value)} />
            <Field label="Soyad" value={profile.surname} onChange={(value) => setProfileValue('surname', value)} />
            <Field label="VKN / TCKN" value={profile.identityNumber} onChange={(value) => setProfileValue('identityNumber', value.replace(/\D/g, '').slice(0, 11))} />
            <Field label="Vergi dairesi" value={profile.taxOffice} onChange={(value) => setProfileValue('taxOffice', value)} />
            <Field label="Telefon" value={profile.gsmNumber} onChange={(value) => setProfileValue('gsmNumber', value)} placeholder="+90 555 000 00 00" />
            <div style={{ gridColumn: '1 / -1' }}><Field label="Fatura e-postası" type="email" value={profile.email} onChange={(value) => setProfileValue('email', value)} /></div>
          </div>
          <AddressFields title="Fatura adresi" value={profile.billingAddress} onChange={(billingAddress) => setProfile((current) => ({ ...current, billingAddress }))} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={shippingSame} onChange={(event) => setShippingSame(event.target.checked)} /> Teslimat adresi fatura adresiyle aynı
          </label>
          {!shippingSame && <AddressFields title="Teslimat adresi" value={profile.shippingAddress} onChange={(shippingAddress) => setProfile((current) => ({ ...current, shippingAddress }))} />}
          {canStartNewCheckout && (
            <>
              <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-inset)', fontSize: 12, lineHeight: 1.55 }}>
                <strong>Ön bilgilendirme ve sözleşme özeti</strong>
                <div style={{ marginTop: 6 }}>
                  {PLAN_DEFINITIONS[selectedPlan].label} · {selectedInterval === 'annual' ? '12 aylık, peşin' : '1 aylık'} ·{' '}
                  {money(planPrices[selectedPlan][selectedInterval])} + KDV
                </div>
                <div>{effectiveProfile.legalName || 'Fatura alıcısı'} · {effectiveProfile.identityNumber || 'VKN/TCKN'} · {effectiveProfile.taxOffice || 'Vergi dairesi'}</div>
                <div style={{ marginTop: 6 }}>
                  <a href={`${process.env.NEXT_PUBLIC_MARKETING_URL || 'http://localhost:3003'}/yasal/abonelik-hizmet-sozlesmesi`} target="_blank" rel="noreferrer">Abonelik Hizmet Sözleşmesi</a>
                  {' · '}
                  <a href={`${process.env.NEXT_PUBLIC_MARKETING_URL || 'http://localhost:3003'}/yasal/iptal-iade-ve-dijital-teslimat`} target="_blank" rel="noreferrer">İptal ve iade politikası</a>
                </div>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={checkoutTermsAccepted} onChange={(event) => setCheckoutTermsAccepted(event.target.checked)} />
                Seçtiğim planı, dönemi, KDV hariç liste fiyatını ve ödeme adımında KDV’nin ayrıca ekleneceğini okudum; Abonelik Hizmet Sözleşmesi’ni ticari işletmem adına onaylıyorum.
              </label>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" aria-busy={profilePending} onClick={saveProfile} disabled={pending || !profileDirty} style={btnGhost()}>{profilePending ? 'Kaydediliyor…' : 'Profili kaydet'}</button>
            {canStartNewCheckout && <button type="button" aria-busy={checkoutPending} onClick={startCheckout} disabled={!checkoutAvailable || pending || !checkoutTermsAccepted} style={btnPrimary({ opacity: !checkoutAvailable || pending || !checkoutTermsAccepted ? .55 : 1, cursor: !checkoutAvailable || pending || !checkoutTermsAccepted ? 'not-allowed' : 'pointer' })}><I.card size={13} />{checkoutPending ? 'Ödeme hazırlanıyor…' : !checkoutAvailable ? 'Güvenli ödeme yakında' : `${PLAN_DEFINITIONS[selectedPlan].label} ödeme adımını aç`}</button>}
          </div>
          {feedback && <div role="status" style={{ fontSize: 12, color: feedback.includes('MAS-') ? 'var(--critical)' : 'var(--positive)', lineHeight: 1.5 }}>{feedback}</div>}
          </div>
        </SCard>
      </div>

      <SCard title="Fatura geçmişi" subtitle="Son 12 abonelik faturası" style={{ marginTop: 16 }}>
        {invoicePollingTimedOut && hasPreparingInvoice && (
          <div role="status" className="border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Fatura işlemi arka planda devam ediyor. Hazır olduğunda bu sayfada indirilebilir olacak.
          </div>
        )}
        {(billing?.invoices.length ?? 0) === 0
          ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>Henüz abonelik faturası yok.</div>
          : <div className={styles.invoiceHistory}>{billing?.invoices.map((invoice) => <InvoiceRow key={invoice.id} restaurantId={restaurantId} invoice={invoice} />)}</div>}
      </SCard>

      <SCard title="İade geçmişi" subtitle="Para hareketleri paket ve özellik erişiminden ayrı yönetilir" style={{ marginTop: 16 }}>
        {(billing?.refunds.length ?? 0) === 0
          ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>Henüz abonelik iadesi yok.</div>
          : billing?.refunds.map((refund) => <RefundRow key={refund.id} refund={refund} />)}
      </SCard>

      <AlertDialog open={planChangeTarget !== null} onOpenChange={(open) => { if (!open && !planChangePending) setPlanChangeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {planChangeTarget ? `${PLAN_DEFINITIONS[planChangeTarget.plan].label}${planChangeTarget.addOns.length ? ` + ${ADD_ON_DEFINITIONS[planChangeTarget.addOns[0]!].label}` : ''} değişikliği planlansın mı?` : 'Abonelik değişikliği'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Mevcut planınız ve özellikleriniz dönem sonuna kadar korunur. Yeni plan yalnız İyzico’daki bir sonraki dönem ödemesi başarıyla alındıktan sonra etkinleşir.
              {planChangeTarget && currentSelfServePlan
                && (PAID_PLANS.indexOf(planChangeTarget.plan) < PAID_PLANS.indexOf(currentSelfServePlan)
                  || planChangeTarget.addOns.length < subscription!.activeAddOns.length)
                ? ' Açık adisyon varsa yeni sipariş girişi durdurulur; mevcut adisyonlar kapandıktan sonra daha düşük plan uygulanır.'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={planChangePending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={pending || !planChangeTarget} onClick={(event) => { event.preventDefault(); schedulePlanChange() }}>
              {planChangePending ? 'Planlanıyor…' : 'Dönem sonuna planla'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancel} onOpenChange={(open) => { if (!cancelPending) setShowCancel(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aboneliği dönem sonunda iptal et?</AlertDialogTitle>
            <AlertDialogDescription>
              Mevcut planınız ve ücretli özellikleriniz ödediğiniz dönemin sonuna kadar açık kalır. Talebi, dönem sonundaki işlem başlamadan önce bu ekrandan geri alabilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <label htmlFor="billing-cancel-password" className="text-sm font-medium">Owner hesap şifresi</label>
            <Input id="billing-cancel-password" type="password" value={cancelPassword} onChange={(event) => setCancelPassword(event.target.value)} autoComplete="current-password" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending || cancelPassword.length === 0}
              onClick={(event) => { event.preventDefault(); cancelSubscription() }}
            >
              {cancelPending ? 'İptal planlanıyor…' : 'Dönem sonunda iptal et'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
