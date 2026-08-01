'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  SubscriptionBillingAddress,
  SubscriptionBillingProfile,
  SubscriptionBillingSettings,
  SubscriptionBillingSettingsInvoice,
} from '@garsonless/application/billing'
import { PLAN_DEFINITIONS, normalizeRestaurantPlan } from '@garsonless/domain/entitlements'
import type { BillingPlanPrices, PaidBillingPlan } from '../../lib/billing/subscription-billing-request'
import {
  cancelBillingSubscriptionAction,
  retryBillingInvoiceAction,
  saveBillingProfileAction,
  startBillingCheckoutAction,
} from '../../lib/actions/billing'
import { I, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { useModalDialogFocus } from '../overlays/use-modal-dialog-focus'
import { notifySettingsSaved } from './settings-dirty-state'
import { SCard, inputStyle } from './primitives'

const EMPTY_ADDRESS: SubscriptionBillingAddress = {
  contactName: '', city: '', district: null, country: 'Türkiye', address: '', zipCode: null,
}

const EMPTY_PROFILE: SubscriptionBillingProfile = {
  legalName: '', name: '', surname: '', identityNumber: '', email: '', gsmNumber: '',
  billingAddress: { ...EMPTY_ADDRESS }, shippingAddress: { ...EMPTY_ADDRESS },
}

const PAID_PLANS: PaidBillingPlan[] = ['starter', 'pro', 'enterprise']

const STATUS_LABELS = {
  trial: 'Deneme', active: 'Aktif', past_due: 'Ödeme gecikti', grace_period: 'Ek süre',
  suspended: 'Askıya alındı', cancelled: 'İptal edildi', manual_hold: 'İncelemede',
} as const

const INVOICE_LABELS = {
  draft: 'Taslak', open: 'Açık', paid: 'Ödendi', past_due: 'Gecikti',
  void: 'İptal', uncollectible: 'Tahsil edilemedi',
} as const

function money(minor: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(minor / 100)
}

function date(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function statusTone(status: string): 'positive' | 'warning' | 'critical' | 'neutral' {
  if (status === 'active' || status === 'paid') return 'positive'
  if (status === 'past_due' || status === 'grace_period' || status === 'open') return 'warning'
  if (status === 'suspended' || status === 'uncollectible') return 'critical'
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

function HostedCheckoutDialog({ content, onClose }: { content: string; onClose: () => void }) {
  const dialogRef = useModalDialogFocus(onClose)
  return (
    <div
      role="presentation"
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.48)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="billing-checkout-title" onMouseDown={(event) => event.stopPropagation()} style={{ width: 'min(720px, 100%)', height: 'min(760px, 92vh)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 70px rgba(15,23,42,.24)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-3)', display: 'grid', placeItems: 'center' }}><I.card size={17} /></div>
          <div style={{ flex: 1 }}>
            <div id="billing-checkout-title" style={{ fontSize: 14, fontWeight: 700 }}>Güvenli ödeme</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>Kart bilgileri İyzico’nun barındırdığı formda girilir; Masabu kart verisini görmez.</div>
          </div>
          <button data-dialog-initial-focus type="button" aria-label="Ödeme penceresini kapat" onClick={onClose} style={btnGhost({ width: 32, padding: 0, justifyContent: 'center' })}><I.close size={15} /></button>
        </div>
        <iframe
          title="İyzico abonelik ödeme formu"
          srcDoc={content}
          sandbox="allow-forms allow-scripts allow-popups allow-top-navigation-by-user-activation"
          referrerPolicy="no-referrer"
          style={{ flex: 1, width: '100%', border: 0, background: '#fff' }}
        />
        <span
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus()}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
        />
      </div>
    </div>
  )
}

function InvoiceRow({ restaurantId, invoice }: { restaurantId: string; invoice: SubscriptionBillingSettingsInvoice }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .9fr .8fr auto', gap: 12, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--divider)' }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{PLAN_DEFINITIONS[invoice.plan].label} · {date(invoice.periodStart)}–{date(invoice.periodEnd)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Vade {date(invoice.dueAt)}</div>
        {message && <div role="status" style={{ fontSize: 11, color: message.includes('MAS-') ? 'var(--critical)' : 'var(--positive)', marginTop: 4 }}>{message}</div>}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 650 }}>{money(invoice.amountDueMinor)}</div>
      <Tag tone={statusTone(invoice.status)}>{INVOICE_LABELS[invoice.status]}</Tag>
      {invoice.canRetry ? (
        <button type="button" onClick={retry} disabled={pending} style={btnGhost()}>{pending ? 'Gönderiliyor…' : 'Tekrar dene'}</button>
      ) : <span style={{ width: 92 }} />}
    </div>
  )
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
  const currentPlan = normalizeRestaurantPlan(restaurantPlan)
  const [profile, setProfile] = useState<SubscriptionBillingProfile>(billing?.profile ?? EMPTY_PROFILE)
  const [shippingSame, setShippingSame] = useState(
    billing?.profile ? JSON.stringify(billing.profile.billingAddress) === JSON.stringify(billing.profile.shippingAddress) : true,
  )
  const [selectedPlan, setSelectedPlan] = useState<PaidBillingPlan>(
    currentPlan === 'free' ? 'starter' : currentPlan,
  )
  const [feedback, setFeedback] = useState(checkoutState === 'success' ? 'Abonelik bilgileri doğrulandı. Ödeme sonucu işlenirken durum otomatik güncellenecek.' : '')
  const [checkoutContent, setCheckoutContent] = useState<string | null>(null)
  const [showCancel, setShowCancel] = useState(false)
  const [pending, startTransition] = useTransition()
  const effectiveProfile = useMemo(() => shippingSame
    ? { ...profile, shippingAddress: { ...profile.billingAddress } }
    : profile, [profile, shippingSame])

  const setProfileValue = (key: keyof Omit<SubscriptionBillingProfile, 'billingAddress' | 'shippingAddress'>, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function saveProfile() {
    setFeedback('')
    startTransition(async () => {
      const result = await saveBillingProfileAction(restaurantId, effectiveProfile)
      if ('error' in result) return setFeedback(failureMessage(result))
      setFeedback('Fatura profili kaydedildi.')
      notifySettingsSaved()
      router.refresh()
    })
  }

  function startCheckout() {
    setFeedback('')
    startTransition(async () => {
      const result = await startBillingCheckoutAction(restaurantId, {
        plan: selectedPlan, profile: effectiveProfile, requestId: crypto.randomUUID(),
      })
      if ('error' in result) return setFeedback(failureMessage(result))
      notifySettingsSaved()
      if (result.checkoutContent) setCheckoutContent(result.checkoutContent)
      else setFeedback('Bu ödeme adımı daha önce başlatıldı. Sonucu görmek için sayfayı yenileyin.')
    })
  }

  function cancelSubscription() {
    setFeedback('')
    startTransition(async () => {
      const result = await cancelBillingSubscriptionAction(restaurantId, { requestId: crypto.randomUUID() })
      if ('error' in result) return setFeedback(failureMessage(result))
      setShowCancel(false)
      setFeedback('Abonelik iptal edildi ve işletme Free plana geçirildi.')
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

  const subscription = billing?.subscription ?? null
  return (
    <>
      {checkoutContent && <HostedCheckoutDialog content={checkoutContent} onClose={() => setCheckoutContent(null)} />}

      <div style={{ padding: 18, marginBottom: 16, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{PLAN_DEFINITIONS[currentPlan].label.slice(0, 3).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 16 }}>{PLAN_DEFINITIONS[currentPlan].label} planı</strong>
            <Tag tone={subscription ? statusTone(subscription.status) : 'neutral'}>{subscription ? STATUS_LABELS[subscription.status] : 'Abonelik yok'}</Tag>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
            {subscription?.currentPeriodEnd ? `Mevcut dönem ${date(subscription.currentPeriodEnd)} tarihinde sona erer.` : 'Ücretli bir plan başlattığınızda dönem ve ödeme durumu burada görünür.'}
          </div>
        </div>
        {subscription && subscription.status !== 'cancelled' && (
          <button type="button" onClick={() => setShowCancel(true)} style={btnGhost({ color: 'var(--critical)', borderColor: 'var(--critical-bg)' })}>Aboneliği iptal et</button>
        )}
      </div>

      {(billing?.attention.reconciliationCount ?? 0) > 0 && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5, display: 'flex', gap: 9 }}>
          <I.warn size={16} /> <span><strong>Ödeme durumu kontrol ediliyor.</strong> Sonucu kesinleşmemiş {billing?.attention.reconciliationCount} işlem var; bu sırada aynı işlemi tekrar başlatmayın.</span>
        </div>
      )}
      {billing?.attention.hasPendingCheckout && (
        <div role="status" style={{ padding: 13, marginBottom: 16, borderRadius: 10, background: 'var(--info-bg)', color: 'var(--info)', fontSize: 12.5 }}>Başlatılmış bir ödeme adımı callback sonucunu bekliyor.</div>
      )}

      <SCard title="Plan seçimi" subtitle="Kart bilgileri yalnız İyzico’nun güvenli ödeme formunda alınır">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {PAID_PLANS.map((plan) => {
            const selected = selectedPlan === plan
            return (
              <button key={plan} type="button" aria-pressed={selected} onClick={() => setSelectedPlan(plan)} style={{ minWidth: 0, padding: 14, borderRadius: 10, border: selected ? '1.5px solid var(--text)' : '1px solid var(--border)', background: selected ? 'var(--surface-inset)' : 'var(--surface)', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{PLAN_DEFINITIONS[plan].label}</div>
                <div style={{ fontSize: 16, fontWeight: 750, marginTop: 8, overflowWrap: 'anywhere' }}>{planPrices[plan] ? `${money(planPrices[plan]!)}/ay` : 'Fiyat yapılandırılmadı'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{PLAN_DEFINITIONS[plan].limits.tables ?? 'Sınırsız'} masa · {PLAN_DEFINITIONS[plan].limits.teamMembers ?? 'Sınırsız'} ekip üyesi</div>
              </button>
            )
          })}
        </div>
      </SCard>

      <SCard title="Fatura profili" subtitle="İyzico abonelik işlemi için zorunlu yasal ve iletişim bilgileri" style={{ marginTop: 16 }}>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Yasal unvan" value={profile.legalName} onChange={(value) => setProfileValue('legalName', value)} /></div>
            <Field label="Ad" value={profile.name} onChange={(value) => setProfileValue('name', value)} />
            <Field label="Soyad" value={profile.surname} onChange={(value) => setProfileValue('surname', value)} />
            <Field label="VKN / TCKN" value={profile.identityNumber} onChange={(value) => setProfileValue('identityNumber', value.replace(/\D/g, '').slice(0, 11))} />
            <Field label="Telefon" value={profile.gsmNumber} onChange={(value) => setProfileValue('gsmNumber', value)} placeholder="+90 555 000 00 00" />
            <div style={{ gridColumn: '1 / -1' }}><Field label="Fatura e-postası" type="email" value={profile.email} onChange={(value) => setProfileValue('email', value)} /></div>
          </div>
          <AddressFields title="Fatura adresi" value={profile.billingAddress} onChange={(billingAddress) => setProfile((current) => ({ ...current, billingAddress }))} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={shippingSame} onChange={(event) => setShippingSame(event.target.checked)} /> Teslimat adresi fatura adresiyle aynı
          </label>
          {!shippingSame && <AddressFields title="Teslimat adresi" value={profile.shippingAddress} onChange={(shippingAddress) => setProfile((current) => ({ ...current, shippingAddress }))} />}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={saveProfile} disabled={pending} style={btnGhost()}>{pending ? 'Kaydediliyor…' : 'Profili kaydet'}</button>
            <button type="button" onClick={startCheckout} disabled={pending || planPrices[selectedPlan] === null} style={btnPrimary({ opacity: pending || planPrices[selectedPlan] === null ? .55 : 1, cursor: pending || planPrices[selectedPlan] === null ? 'not-allowed' : 'pointer' })}><I.card size={13} />{pending ? 'Hazırlanıyor…' : `${PLAN_DEFINITIONS[selectedPlan].label} ödeme adımını aç`}</button>
          </div>
          {feedback && <div role="status" style={{ fontSize: 12, color: feedback.includes('MAS-') ? 'var(--critical)' : 'var(--positive)', lineHeight: 1.5 }}>{feedback}</div>}
        </div>
      </SCard>

      <SCard title="Fatura geçmişi" subtitle="Son 12 abonelik faturası" style={{ marginTop: 16 }}>
        {(billing?.invoices.length ?? 0) === 0
          ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>Henüz abonelik faturası yok.</div>
          : billing?.invoices.map((invoice) => <InvoiceRow key={invoice.id} restaurantId={restaurantId} invoice={invoice} />)}
      </SCard>

      {showCancel && (
        <div role="alertdialog" aria-modal="false" aria-labelledby="billing-cancel-title" style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--critical-bg)', borderLeft: '3px solid var(--critical)' }}>
          <div id="billing-cancel-title" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--critical)' }}>Aboneliği hemen iptal et?</div>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-2)', margin: '5px 0 12px' }}>İyzico aboneliği anında iptal edilir ve işletme Free plana döner. Ücretli özellikler hemen kapanabilir.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setShowCancel(false)} style={btnGhost()}>Vazgeç</button>
            <button type="button" onClick={cancelSubscription} disabled={pending} style={btnPrimary({ background: 'var(--critical)', borderColor: 'var(--critical)' })}>{pending ? 'İptal ediliyor…' : 'Evet, aboneliği iptal et'}</button>
          </div>
        </div>
      )}
    </>
  )
}
