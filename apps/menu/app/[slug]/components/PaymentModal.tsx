'use client'

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { formatTRY, useTheme } from '@garsonless/ui/menu'
import { AppIcons as I } from '@garsonless/ui/icons'
import {
  resolveCheckoutErrorState,
  resolveCheckoutPaymentState,
  resolveCheckoutSuccessState,
  resolveCheckoutSurfacePalette,
  resolveCheckoutTablePaymentState,
  type CheckoutErrorIcon,
  type CheckoutPreviewState,
  type CheckoutSuccessIcon,
  type CheckoutTablePaymentIcon,
} from '@garsonless/design-engine'
import {
  readTrustedPaymentCallbackMessage,
  resolvePaymentCallbackOutcome,
} from '../../../lib/payment-callback-message'

interface Props {
  orderId: string
  total: number
  restaurantId: string
  tableToken: string
  restaurantName: string
  tableLabel?: string | null
  deviceId: string
  initialBuyerName?: string | null
  onClose: () => void
  onSuccess: () => void
  onPayAtTable?: () => Promise<boolean>
  onDeferred?: () => void
  /** Theme editor only. Keeps the production UI interactive without creating a payment request. */
  previewState?: Exclude<CheckoutPreviewState, 'cart'>
}

interface BuyerInfo {
  name: string
  surname: string
  email: string
  phone: string
  identityNumber: string
}

type Step = 'form' | 'iframe' | 'success' | 'table-success' | 'error'
type PaymentChoice = 'card' | 'table'

function previewStep(state?: Exclude<CheckoutPreviewState, 'cart'>): Step {
  if (state === 'success') return 'success'
  if (state === 'table-payment') return 'table-success'
  if (state === 'error') return 'error'
  return 'form'
}

function splitName(fullName?: string | null): Pick<BuyerInfo, 'name' | 'surname'> {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  return {
    name: parts[0] ?? '',
    surname: parts.slice(1).join(' '),
  }
}

export default function PaymentModal({
  orderId,
  total,
  restaurantId,
  tableToken,
  restaurantName,
  tableLabel,
  deviceId,
  initialBuyerName,
  onClose,
  onSuccess,
  onPayAtTable,
  onDeferred,
  previewState,
}: Props) {
  const { theme } = useTheme()
  const checkoutTheme = theme.surfaces?.checkout
  const checkoutOverride = checkoutTheme?.override ?? {}
  const checkoutPalette = resolveCheckoutSurfacePalette(theme)
  const paymentTheme = resolveCheckoutPaymentState(checkoutTheme)
  const successTheme = resolveCheckoutSuccessState(checkoutTheme)
  const tablePaymentTheme = resolveCheckoutTablePaymentState(checkoutTheme)
  const errorTheme = resolveCheckoutErrorState(checkoutTheme)
  const initialName = splitName(initialBuyerName)
  const [step, setStep] = useState<Step>(() => previewStep(previewState))
  const [choice, setChoice] = useState<PaymentChoice>('card')
  const [paymentPageUrl, setPaymentPageUrl] = useState('')
  const paymentFrameRef = useRef<HTMLIFrameElement>(null)
  const [errorMsg, setErrorMsg] = useState(previewState === 'error' ? 'Kartından tahsilat yapılmadı. Yeniden deneyebilirsin.' : '')
  const [loading, setLoading] = useState(false)
  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: initialName.name,
    surname: initialName.surname,
    email: '',
    phone: '',
    identityNumber: '',
  })

  function updateBuyer(field: keyof BuyerInfo, value: string) {
    setBuyer((previous) => ({ ...previous, [field]: value }))
  }

  async function initializePayment() {
    if (previewState) return
    setLoading(true)
    setErrorMsg('')

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          total,
          restaurantId,
          tableToken,
          deviceId,
          buyerName: buyer.name.trim(),
          buyerSurname: buyer.surname.trim(),
          buyerEmail: buyer.email.trim(),
          buyerPhone: buyer.phone.trim(),
          buyerIdentityNumber: buyer.identityNumber.trim(),
        }),
      })
      const data = (await response.json()) as
        | { success: true; data: { paymentPageUrl: string; token: string } }
        | { success: false; error: string }

      if (!data.success) {
        setErrorMsg(data.error)
        setStep('error')
        return
      }

      setPaymentPageUrl(data.data.paymentPageUrl)
      setStep('iframe')
    } catch {
      setErrorMsg('Ödeme başlatılamadı. Bağlantını kontrol edip tekrar dene.')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (previewState) return
    if (choice === 'table') {
      if (!onPayAtTable) return
      setLoading(true)
      setErrorMsg('')
      const called = await onPayAtTable()
      setLoading(false)
      if (!called) {
        setErrorMsg('Garson çağrısı gönderilemedi. Lütfen tekrar dene.')
        setStep('error')
        return
      }
      setStep('table-success')
      return
    }
    await initializePayment()
  }

  useEffect(() => {
    if (previewState) return
    if (step !== 'iframe') return

    function handleIframeMessage(event: MessageEvent) {
      const message = readTrustedPaymentCallbackMessage(
        event,
        window.location.origin,
        paymentFrameRef.current?.contentWindow,
      )
      if (!message) return
      const outcome = resolvePaymentCallbackOutcome('order', message)
      if (outcome?.status === 'success') {
        setStep('success')
      } else if (outcome?.status === 'failed') {
        setErrorMsg(
          outcome.reason || 'Ödeme tamamlanamadı. Lütfen tekrar dene.',
        )
        setStep('error')
      }
    }

    window.addEventListener('message', handleIframeMessage)
    return () => window.removeEventListener('message', handleIframeMessage)
  }, [previewState, step])

  useEffect(() => {
    if (!previewState) return
    setStep(previewStep(previewState))
    if (previewState === 'error') setErrorMsg('Kartından tahsilat yapılmadı. Yeniden deneyebilirsin.')
  }, [previewState])

  const title =
    step === 'success' ? successTheme.title
    : step === 'table-success' ? tablePaymentTheme.title
    : step === 'iframe' ? 'Güvenli ödeme'
    : step === 'form' ? paymentTheme.title
    : errorTheme.title
  const activeResultTheme = step === 'table-success' ? tablePaymentTheme : step === 'error' ? errorTheme : successTheme
  const resultContentWidth = activeResultTheme.layout.contentWidth === 'compact'
    ? '320px'
    : activeResultTheme.layout.contentWidth === 'full' ? '100%' : '380px'
  const paymentVars = {
    '--pay-bg': checkoutPalette.background,
    '--pay-card': checkoutPalette.surface,
    '--pay-ink': checkoutPalette.text,
    '--pay-muted': checkoutPalette.mutedText,
    '--pay-field': checkoutPalette.fieldSurface,
    '--pay-field-border': checkoutPalette.fieldBorder,
    '--pay-accent': checkoutPalette.accent,
    '--pay-cta': checkoutPalette.cta,
    '--pay-cta-text': checkoutPalette.ctaText,
    '--pay-radius': `${checkoutOverride.radius ?? theme.radius}px`,
    '--pay-sheet-width': checkoutTheme?.sheetSize === 'compact' ? '400px' : checkoutTheme?.sheetSize === 'large' ? '680px' : '520px',
    '--pay-sheet-height': checkoutTheme?.sheetSize === 'compact' ? '76dvh' : checkoutTheme?.sheetSize === 'large' ? '94dvh' : '88dvh',
    '--pay-form-padding-x': `${paymentTheme.layout.paddingX}px`,
    '--pay-section-gap': `${paymentTheme.layout.sectionGap}px`,
    '--pay-form-width': paymentTheme.layout.contentWidth === 'wide' ? '620px' : '520px',
    '--pay-control-height': paymentTheme.layout.density === 'compact' ? '36px' : '42px',
    '--pay-method-height': paymentTheme.layout.density === 'compact' ? '54px' : '66px',
    '--pay-cta-height': paymentTheme.layout.density === 'compact' ? '46px' : '54px',
    '--pay-result-padding-x': `${activeResultTheme.layout.paddingX}px`,
    '--pay-result-padding-y': `${activeResultTheme.layout.paddingY}px`,
    '--pay-result-gap': `${activeResultTheme.layout.contentGap}px`,
    '--pay-result-align': activeResultTheme.layout.align,
    '--pay-result-items': activeResultTheme.layout.align === 'left' ? 'flex-start' : 'center',
    '--pay-result-width': resultContentWidth,
    '--pay-result-icon-size': `${activeResultTheme.layout.iconSize}px`,
    '--pay-result-icon-color': activeResultTheme.iconColor,
    '--pay-result-icon-bg': activeResultTheme.iconBackground,
    '--p-body': checkoutOverride.bodyFont ?? theme.bodyFont,
  } as CSSProperties

  return (
    <div className="payment-overlay" data-checkout-preset={checkoutTheme?.preset ?? 'clean'} data-checkout-sheet-size={checkoutTheme?.sheetSize ?? 'standard'} data-preview={previewState ? 'true' : undefined} role="dialog" aria-modal="true" aria-label={title} style={paymentVars}>
      <style>{PAYMENT_CSS}</style>
      <button type="button" className="payment-backdrop" aria-label="Ödeme penceresini kapat" onClick={onClose} />
      <section className="payment-sheet">
        <div className="payment-handle" />
        <header className="payment-header">
          {step === 'iframe' && (
            <button type="button" className="payment-icon-btn" aria-label="Ödeme bilgilerine dön" onClick={() => setStep('form')}>
              <I.chevLeft size={18} />
            </button>
          )}
          <div className="payment-heading">
            <h2>{title}</h2>
            {(step !== 'form' || paymentTheme.description) && <p>{step === 'form' ? paymentTheme.description : `${restaurantName}${tableLabel ? ` · ${tableLabel}` : ''}`}</p>}
          </div>
          <button type="button" className="payment-icon-btn" aria-label="Kapat" onClick={onClose}>
            <I.close size={18} />
          </button>
        </header>

        {step === 'form' && (
          <form className="payment-form" onSubmit={submit}>
            <div className="payment-scroll">
              <AmountCard total={total} label={paymentTheme.amountLabel} />

              <div className="payment-block">
                <h3>{paymentTheme.methodSectionTitle}</h3>
                <MethodButton
                  active={choice === 'card'}
                  icon={<I.card size={21} />}
                  title="Kart ile online öde"
                  description="İyzico güvenli ödeme sayfası"
                  onClick={() => setChoice('card')}
                />
                {onPayAtTable && (
                  <MethodButton
                    active={choice === 'table'}
                    icon={<I.bell size={21} />}
                    title="Masada öde"
                    description="Garson nakit veya fiziksel POS ile tahsil eder"
                    onClick={() => setChoice('table')}
                  />
                )}
              </div>

              {choice === 'card' && (
                <div className="payment-block payment-buyer">
                  <div className="payment-block-title">
                    <div>
                      <h3>{paymentTheme.buyerSectionTitle}</h3>
                      <p>{paymentTheme.buyerSectionDescription}</p>
                    </div>
                    <I.user size={18} />
                  </div>
                  <div className="payment-name-grid">
                    <Field label="Ad">
                      <input
                        required
                        autoComplete="given-name"
                        maxLength={50}
                        value={buyer.name}
                        onChange={(event) => updateBuyer('name', event.target.value)}
                      />
                    </Field>
                    <Field label="Soyad">
                      <input
                        required
                        autoComplete="family-name"
                        maxLength={50}
                        value={buyer.surname}
                        onChange={(event) => updateBuyer('surname', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="E-posta" icon={<I.mail size={15} />}>
                    <input
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="email"
                      maxLength={254}
                      placeholder="ornek@email.com"
                      value={buyer.email}
                      onChange={(event) => updateBuyer('email', event.target.value)}
                    />
                  </Field>
                  <Field label="Telefon" icon={<I.phone size={15} />}>
                    <input
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="05xx xxx xx xx"
                      value={buyer.phone}
                      onChange={(event) => updateBuyer('phone', event.target.value)}
                    />
                  </Field>
                  <Field label="T.C. kimlik / pasaport no" icon={<I.shield size={15} />}>
                    <input
                      required
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      minLength={5}
                      maxLength={32}
                      pattern="[A-Za-z0-9]+"
                      placeholder="Ödeme sağlayıcısının istediği kimlik no"
                      value={buyer.identityNumber}
                      onChange={(event) => updateBuyer('identityNumber', event.target.value)}
                    />
                  </Field>
                  <p className="payment-identity-note">Yalnız ödeme işlemi için İyzico'ya aktarılır; Masabu'da saklanmaz.</p>
                </div>
              )}

              {choice === 'table' && (
                <div className="payment-table-note">
                  <I.receipt size={18} />
                  <div>
                    <strong>Siparişin oluşturuldu.</strong>
                    <span>Garson hesabı masada tahsil edecek; bu ekranda ödeme alınmaz.</span>
                  </div>
                </div>
              )}
            </div>

            <footer className="payment-footer">
              <button type="submit" className="payment-cta" disabled={loading}>
                {loading ? (
                  <><Spinner />{choice === 'card' ? 'Ödeme hazırlanıyor…' : 'Garson çağrılıyor…'}</>
                ) : choice === 'card' ? (
                  <>{formatTRY(total)} {paymentTheme.cardActionLabel} <I.chevRight size={17} /></>
                ) : (
                  <>{paymentTheme.tableActionLabel} <I.bell size={17} /></>
                )}
              </button>
              {choice === 'card' && (
                <div className="payment-security">
                  <I.shield size={13} />
                  <span>İyzico güvenli ödeme altyapısı</span>
                </div>
              )}
            </footer>
          </form>
        )}

        {step === 'iframe' && paymentPageUrl && (
          <div className="payment-checkout">
            <div className="payment-checkout-note">
              <I.lock size={14} />
              Kart bilgilerin doğrudan İyzico tarafından alınır.
            </div>
            <iframe ref={paymentFrameRef} src={paymentPageUrl} title="İyzico güvenli ödeme" />
          </div>
        )}

        {step === 'success' && (
          <Result
            tone="success"
            title={successTheme.title}
            description={successTheme.description}
            icon={successTheme.icon}
            total={total}
            orderId={orderId}
            tableLabel={tableLabel}
            method="İyzico online"
            actionLabel={successTheme.primaryActionLabel}
            onAction={onSuccess}
          />
        )}

        {step === 'table-success' && (
          <Result
            tone="table"
            title={tablePaymentTheme.title}
            description={tablePaymentTheme.description}
            icon={tablePaymentTheme.icon}
            total={total}
            orderId={orderId}
            tableLabel={tableLabel}
            method="Masada tahsilat bekleniyor"
            actionLabel={tablePaymentTheme.primaryActionLabel}
            onAction={() => {
              onDeferred?.()
              onClose()
            }}
          />
        )}

        {step === 'error' && (
          <div className="payment-result" role="alert" aria-live="assertive">
            <div className="payment-result-icon payment-result-icon--error">
              <CheckoutResultIcon icon={errorTheme.icon} size={Math.round(errorTheme.layout.iconSize * .38)} />
            </div>
            <h3>{errorTheme.title}</h3>
            <p>{errorMsg}</p>
            <div className="payment-error-note">
              Siparişin oluşturuldu ancak henüz ödenmedi. Yeniden deneyebilir
              {onPayAtTable ? ' veya masada ödeme seçeneğini kullanabilirsin.' : '.'}
            </div>
            <button type="button" className="payment-cta" onClick={() => { if (!previewState) setStep('form') }}>
              {errorTheme.primaryActionLabel}
            </button>
            <button type="button" className="payment-secondary-action" onClick={onClose}>
              {errorTheme.secondaryActionLabel}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function AmountCard({ total, label }: { total: number; label: string }) {
  return (
    <div className="payment-amount">
      <div>
        <span>{label}</span>
        <small>Sipariş toplamı</small>
      </div>
      <strong>{formatTRY(total)}</strong>
    </div>
  )
}

function MethodButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button type="button" className={`payment-method${active ? ' payment-method--active' : ''}`} onClick={onClick}>
      <span className="payment-method-icon">{icon}</span>
      <span className="payment-method-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="payment-radio">{active && <I.check size={13} />}</span>
    </button>
  )
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="payment-field">
      <span>{icon}{label}</span>
      {children}
    </label>
  )
}

function Result({
  tone,
  title,
  description,
  icon,
  total,
  orderId,
  tableLabel,
  method,
  actionLabel,
  onAction,
}: {
  tone: 'success' | 'table'
  title: string
  description: string
  icon: CheckoutSuccessIcon | CheckoutTablePaymentIcon
  total: number
  orderId: string
  tableLabel?: string | null
  method: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="payment-result" role="status" aria-live="polite">
      <div className={`payment-result-icon payment-result-icon--${tone}`}>
        <CheckoutResultIcon icon={icon} size={34} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>

      <div className="payment-receipt">
        <div className="payment-receipt-total">
          <span>{tone === 'success' ? 'Ödenen tutar' : 'Masada ödenecek'}</span>
          <strong>{formatTRY(total)}</strong>
        </div>
        <div className="payment-receipt-line" />
        <ReceiptRow label="Sipariş" value={`#${orderId.slice(0, 8).toUpperCase()}`} />
        {tableLabel && <ReceiptRow label="Masa" value={tableLabel} />}
        <ReceiptRow label="Yöntem" value={method} />
        <ReceiptRow label="Durum" value={tone === 'success' ? 'Onaylandı' : 'Bekleniyor'} accent />
      </div>

      <button type="button" className="payment-cta" onClick={onAction}>
        {actionLabel} <I.chevRight size={17} />
      </button>
    </div>
  )
}

function CheckoutResultIcon({
  icon,
  size,
}: {
  icon: CheckoutSuccessIcon | CheckoutTablePaymentIcon | CheckoutErrorIcon
  size: number
}) {
  const Icon = {
    check: I.check,
    receipt: I.receipt,
    shield: I.shield,
    sparkles: I.sparkles,
    bell: I.bell,
    clock: I.clock,
    card: I.card,
    warn: I.warn,
    close: I.close,
    refresh: I.refresh,
    lock: I.lock,
  }[icon]
  return <Icon aria-hidden="true" size={size} />
}

function ReceiptRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="payment-receipt-row">
      <span>{label}</span>
      <strong className={accent ? 'payment-receipt-accent' : ''}>{value}</strong>
    </div>
  )
}

function Spinner() {
  return <span className="payment-spinner" aria-hidden="true" />
}

const PAYMENT_CSS = `
  .payment-overlay {
    --pay-bg: var(--p-bg, #f4f0e8);
    --pay-card: #fff;
    --pay-ink: var(--p-text, #1b1c1e);
    --pay-muted: var(--p-text-2, #6b6e74);
    --pay-accent: var(--p-accent, #2f6f4e);
    --pay-cta: var(--pay-accent);
    --pay-field: var(--pay-bg);
    --pay-field-border: rgba(27,28,30,.16);
    --pay-line: var(--pay-field-border);
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-family: var(--p-body, Geist, system-ui, sans-serif);
  }
  .payment-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    border: 0;
    background: rgba(20,22,20,.46);
    backdrop-filter: blur(3px);
    cursor: default;
    animation: payment-fade .2s ease;
  }
  .payment-sheet {
    position: relative;
    width: min(100%, var(--pay-sheet-width, 520px));
    max-height: min(var(--pay-sheet-height, 88dvh), 900px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: calc(var(--pay-radius) + 15px) calc(var(--pay-radius) + 15px) 0 0;
    background: var(--pay-bg);
    color: var(--pay-ink);
    box-shadow: 0 -12px 44px rgba(20,22,20,.18);
    animation: payment-sheet-up .3s cubic-bezier(.2,.8,.25,1);
  }
  .payment-handle {
    width: 38px;
    height: 4px;
    flex: 0 0 auto;
    margin: 9px auto 0;
    border-radius: 999px;
    background: rgba(27,28,30,.14);
  }
  .payment-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px 12px;
  }
  .payment-overlay[data-checkout-preset="brand-header"] .payment-header { padding: 18px 16px; background: var(--pay-accent); color: var(--pay-cta-text); }
  .payment-overlay[data-checkout-preset="brand-header"] .payment-heading p { color: color-mix(in srgb,var(--pay-cta-text) 72%,transparent); }
  .payment-overlay[data-checkout-preset="brand-header"] .payment-icon-btn { border-color: color-mix(in srgb,var(--pay-cta-text) 26%,transparent); background: color-mix(in srgb,var(--pay-cta-text) 14%,transparent); color: var(--pay-cta-text); }
  .payment-overlay[data-checkout-preset="soft"] .payment-sheet { background: color-mix(in srgb,var(--pay-bg) 82%,var(--pay-card)); }
  .payment-heading { min-width: 0; flex: 1; }
  .payment-heading h2 { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 800; letter-spacing: 0; }
  .payment-heading p { margin: 3px 0 0; overflow: hidden; color: var(--pay-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .payment-icon-btn {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--pay-line);
    border-radius: 999px;
    background: var(--pay-card);
    color: var(--pay-muted);
    cursor: pointer;
  }
  .payment-form { min-height: 0; display: flex; flex: 1; flex-direction: column; }
  .payment-scroll { width: 100%; max-width: var(--pay-form-width, 520px); min-height: 0; margin: 0 auto; overflow-y: auto; padding: 0 var(--pay-form-padding-x, 16px) 16px; }
  .payment-amount {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    border-radius: 18px;
    background: #1b1c1e;
    color: #fff;
    box-shadow: 0 8px 24px rgba(20,22,20,.12);
  }
  .payment-amount span { display: block; color: rgba(255,255,255,.72); font-size: 12px; font-weight: 700; }
  .payment-amount small { display: block; margin-top: 4px; color: rgba(255,255,255,.44); font-size: 11px; }
  .payment-amount strong { font-variant-numeric: tabular-nums; font-size: 27px; line-height: 1; font-weight: 800; white-space: nowrap; }
  .payment-block { margin-top: var(--pay-section-gap, 16px); }
  .payment-block > h3, .payment-block-title h3 { margin: 0 0 8px; color: var(--pay-muted); font-size: 12px; font-weight: 700; }
  .payment-method {
    width: 100%;
    min-height: var(--pay-method-height, 66px);
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
    padding: 11px 12px;
    border: 1.5px solid transparent;
    border-radius: 15px;
    background: var(--pay-card);
    color: var(--pay-ink);
    text-align: left;
    box-shadow: 0 1px 2px rgba(20,22,20,.04);
    cursor: pointer;
  }
  .payment-method--active {
    border-color: var(--pay-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pay-accent) 14%, transparent);
  }
  .payment-method-icon {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 11px;
    background: color-mix(in srgb, var(--pay-accent) 11%, white);
    color: var(--pay-accent);
  }
  .payment-method-copy { min-width: 0; flex: 1; }
  .payment-method-copy strong { display: block; font-size: 13.5px; font-weight: 700; }
  .payment-method-copy small { display: block; margin-top: 2px; color: var(--pay-muted); font-size: 11px; line-height: 1.35; }
  .payment-radio {
    width: 21px;
    height: 21px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--pay-line);
    border-radius: 999px;
    color: white;
  }
  .payment-method--active .payment-radio { border-color: var(--pay-accent); background: var(--pay-accent); }
  .payment-buyer {
    padding: 14px;
    border: 1px solid var(--pay-line);
    border-radius: 18px;
    background: var(--pay-card);
  }
  .payment-block-title { display: flex; align-items: flex-start; justify-content: space-between; color: var(--pay-muted); }
  .payment-block-title h3 { margin-bottom: 0; color: var(--pay-ink); font-size: 13px; }
  .payment-block-title p { margin: 3px 0 0; color: var(--pay-muted); font-size: 10.5px; }
  .payment-name-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .payment-field { display: block; margin-top: 10px; }
  .payment-field > span { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; color: var(--pay-muted); font-size: 11px; font-weight: 700; }
  .payment-field input {
    width: 100%;
    height: var(--pay-control-height, 42px);
    padding: 0 11px;
    border: 1px solid var(--pay-field-border);
    border-radius: 11px;
    outline: none;
    background: var(--pay-field);
    color: var(--pay-ink);
    font: inherit;
    font-size: 13px;
  }
  .payment-field input:focus { border-color: var(--pay-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pay-accent) 12%, transparent); }
  .payment-identity-note { margin: -3px 0 0; color: var(--pay-muted); font-size: 11px; line-height: 1.45; }
  .payment-table-note, .payment-error-note {
    display: flex;
    gap: 10px;
    margin-top: 14px;
    padding: 12px 13px;
    border-radius: 13px;
    background: color-mix(in srgb, var(--pay-accent) 10%, white);
    color: var(--pay-accent);
  }
  .payment-table-note svg { flex: 0 0 auto; margin-top: 1px; }
  .payment-table-note strong { display: block; font-size: 12px; }
  .payment-table-note span { display: block; margin-top: 3px; font-size: 11px; line-height: 1.45; }
  .payment-footer { padding: 12px var(--pay-form-padding-x, 16px) max(18px, env(safe-area-inset-bottom)); border-top: 1px solid var(--pay-line); background: var(--pay-bg); }
  .payment-footer > * { max-width: var(--pay-form-width, 520px); margin-left: auto; margin-right: auto; }
  .payment-cta {
    width: 100%;
    height: var(--pay-cta-height, 54px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 16px;
    background: var(--pay-cta);
    color: var(--pay-cta-text);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }
  .payment-cta:disabled { cursor: wait; opacity: .65; }
  .payment-security { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; color: var(--pay-muted); font-size: 10.5px; }
  .payment-checkout { min-height: 0; flex: 1; overflow: auto; padding: 0 12px 14px; }
  .payment-checkout-note { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; color: var(--pay-muted); font-size: 11px; }
  .payment-checkout iframe { width: 100%; height: min(650px, 74dvh); border: 1px solid var(--pay-line); border-radius: 16px; background: white; }
  .payment-result {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: var(--pay-result-items, center);
    gap: var(--pay-result-gap, 16px);
    overflow-y: auto;
    padding: var(--pay-result-padding-y, 18px) var(--pay-result-padding-x, 18px) max(var(--pay-result-padding-y, 18px), env(safe-area-inset-bottom));
    text-align: var(--pay-result-align, center);
  }
  .payment-result > * { width: 100%; max-width: var(--pay-result-width, 380px); margin-left: 0; margin-right: 0; }
  .payment-result-icon {
    width: var(--pay-result-icon-size, 84px);
    height: var(--pay-result-icon-size, 84px);
    max-width: var(--pay-result-icon-size, 84px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--pay-result-icon-bg);
    color: var(--pay-result-icon-color);
    animation: payment-pop .45s cubic-bezier(.2,.8,.3,1.25);
  }
  .payment-result-icon svg { width: 38%; height: 38%; }
  .payment-result h3 { margin: 0; font-size: 23px; font-weight: 800; }
  .payment-result > p { margin-top: calc(var(--pay-result-gap, 16px) * -.5); color: var(--pay-muted); font-size: 12.5px; line-height: 1.5; }
  .payment-receipt { margin-top: 4px; padding: 16px; border-radius: 18px; background: var(--pay-card); box-shadow: 0 1px 2px rgba(20,22,20,.05), 0 8px 24px rgba(20,22,20,.05); text-align: left; }
  .payment-receipt-total { text-align: center; }
  .payment-receipt-total span { display: block; color: var(--pay-muted); font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
  .payment-receipt-total strong { display: block; margin-top: 3px; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 800; }
  .payment-receipt-line { margin: 14px 0 6px; border-top: 2px dashed var(--pay-line); }
  .payment-receipt-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--pay-line); font-size: 12px; }
  .payment-receipt-row:last-child { border-bottom: 0; }
  .payment-receipt-row span { color: var(--pay-muted); }
  .payment-receipt-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .payment-receipt-accent { color: var(--pay-result-icon-color); }
  .payment-error-note { display: block; margin: 0; background: #fde7e5; color: #8f2018; font-size: 11.5px; line-height: 1.5; text-align: left; }
  .payment-secondary-action { height: 42px; border: 0; background: transparent; color: var(--pay-muted); font-size: 12px; font-weight: 700; cursor: pointer; }
  .payment-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 999px; animation: payment-spin .7s linear infinite; }
  @keyframes payment-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes payment-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes payment-pop { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
  @keyframes payment-spin { to { transform: rotate(360deg); } }
  @media (min-width: 640px) {
    .payment-overlay { align-items: center; padding: 24px; }
    .payment-sheet { border-radius: 24px; }
  }
  @media (max-width: 380px) {
    .payment-name-grid { grid-template-columns: 1fr; gap: 0; }
    .payment-amount strong { font-size: 24px; }
  }
`
