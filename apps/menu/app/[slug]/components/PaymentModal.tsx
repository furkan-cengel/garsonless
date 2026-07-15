'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { formatTRY } from '@garsonless/ui'
import { AppIcons as I } from '@garsonless/ui/icons'

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
}

interface BuyerInfo {
  name: string
  surname: string
  email: string
  phone: string
}

type Step = 'form' | 'iframe' | 'success' | 'table-success' | 'error'
type PaymentChoice = 'card' | 'table'

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
}: Props) {
  const initialName = splitName(initialBuyerName)
  const [step, setStep] = useState<Step>('form')
  const [choice, setChoice] = useState<PaymentChoice>('card')
  const [paymentPageUrl, setPaymentPageUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: initialName.name,
    surname: initialName.surname,
    email: '',
    phone: '',
  })

  function updateBuyer(field: keyof BuyerInfo, value: string) {
    setBuyer((previous) => ({ ...previous, [field]: value }))
  }

  async function initializePayment() {
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
    if (step !== 'iframe') return

    function handleIframeMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (typeof event.data !== 'object' || event.data === null) return
      const message = event.data as Record<string, unknown>

      if (message['type'] === 'PAYMENT_SUCCESS') {
        setStep('success')
      } else if (message['type'] === 'PAYMENT_FAILED') {
        setErrorMsg(
          typeof message['reason'] === 'string' && message['reason']
            ? message['reason']
            : 'Ödeme tamamlanamadı. Lütfen tekrar dene.',
        )
        setStep('error')
      }
    }

    window.addEventListener('message', handleIframeMessage)
    return () => window.removeEventListener('message', handleIframeMessage)
  }, [step])

  const title =
    step === 'success' ? 'İşlem tamamlandı'
    : step === 'table-success' ? 'Talep iletildi'
    : step === 'iframe' ? 'Güvenli ödeme'
    : 'Ödeme'

  return (
    <div className="payment-overlay" role="dialog" aria-modal="true" aria-label={title}>
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
            <p>{restaurantName}{tableLabel ? ` · ${tableLabel}` : ''}</p>
          </div>
          <button type="button" className="payment-icon-btn" aria-label="Kapat" onClick={onClose}>
            <I.close size={18} />
          </button>
        </header>

        {step === 'form' && (
          <form className="payment-form" onSubmit={submit}>
            <div className="payment-scroll">
              <AmountCard total={total} />

              <div className="payment-block">
                <h3>Ödeme yöntemi</h3>
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
                      <h3>Ödeyen kişi</h3>
                      <p>İyzico işlemi için gerekli bilgiler</p>
                    </div>
                    <I.user size={18} />
                  </div>
                  <div className="payment-name-grid">
                    <Field label="Ad">
                      <input
                        required
                        autoComplete="given-name"
                        value={buyer.name}
                        onChange={(event) => updateBuyer('name', event.target.value)}
                      />
                    </Field>
                    <Field label="Soyad">
                      <input
                        required
                        autoComplete="family-name"
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
                      placeholder="05xx xxx xx xx"
                      value={buyer.phone}
                      onChange={(event) => updateBuyer('phone', event.target.value)}
                    />
                  </Field>
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
                  <>{formatTRY(total)} öde <I.chevRight size={17} /></>
                ) : (
                  <>Garsonu çağır <I.bell size={17} /></>
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
            <iframe src={paymentPageUrl} title="İyzico güvenli ödeme" />
          </div>
        )}

        {step === 'success' && (
          <Result
            tone="success"
            title="Ödeme alındı"
            description="Ödemen doğrulandı. Masan açık kalır; dilersen sipariş vermeye devam edebilirsin."
            total={total}
            orderId={orderId}
            tableLabel={tableLabel}
            method="İyzico online"
            actionLabel="Siparişimi takip et"
            onAction={onSuccess}
          />
        )}

        {step === 'table-success' && (
          <Result
            tone="table"
            title="Garson geliyor"
            description="Talebin ekibe iletildi. Ödeme masada nakit veya fiziksel POS ile alınacak."
            total={total}
            orderId={orderId}
            tableLabel={tableLabel}
            method="Masada tahsilat bekleniyor"
            actionLabel="Siparişimi takip et"
            onAction={() => {
              onDeferred?.()
              onClose()
            }}
          />
        )}

        {step === 'error' && (
          <div className="payment-result">
            <div className="payment-result-icon payment-result-icon--error">
              <I.warn size={31} />
            </div>
            <h3>İşlem tamamlanamadı</h3>
            <p>{errorMsg}</p>
            <div className="payment-error-note">
              Siparişin oluşturuldu ancak henüz ödenmedi. Yeniden deneyebilir
              {onPayAtTable ? ' veya masada ödeme seçeneğini kullanabilirsin.' : '.'}
            </div>
            <button type="button" className="payment-cta" onClick={() => setStep('form')}>
              Tekrar dene
            </button>
            <button type="button" className="payment-secondary-action" onClick={onClose}>
              Şimdilik kapat
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function AmountCard({ total }: { total: number }) {
  return (
    <div className="payment-amount">
      <div>
        <span>Ödenecek tutar</span>
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
  total: number
  orderId: string
  tableLabel?: string | null
  method: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="payment-result">
      <div className={`payment-result-icon payment-result-icon--${tone}`}>
        {tone === 'success' ? <I.check size={34} /> : <I.bell size={31} />}
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
    --pay-line: rgba(27,28,30,.09);
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
    width: min(100%, 470px);
    max-height: min(92dvh, 850px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 26px 26px 0 0;
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
  .payment-scroll { min-height: 0; overflow-y: auto; padding: 0 16px 16px; }
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
  .payment-block { margin-top: 16px; }
  .payment-block > h3, .payment-block-title h3 { margin: 0 0 8px; color: var(--pay-muted); font-size: 12px; font-weight: 700; }
  .payment-method {
    width: 100%;
    min-height: 66px;
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
    height: 42px;
    padding: 0 11px;
    border: 1px solid var(--pay-line);
    border-radius: 11px;
    outline: none;
    background: var(--pay-bg);
    color: var(--pay-ink);
    font: inherit;
    font-size: 13px;
  }
  .payment-field input:focus { border-color: var(--pay-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pay-accent) 12%, transparent); }
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
  .payment-footer { padding: 12px 16px max(18px, env(safe-area-inset-bottom)); border-top: 1px solid var(--pay-line); background: var(--pay-bg); }
  .payment-cta {
    width: 100%;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 16px;
    background: var(--pay-accent);
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }
  .payment-cta:disabled { cursor: wait; opacity: .65; }
  .payment-security { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; color: var(--pay-muted); font-size: 10.5px; }
  .payment-checkout { min-height: 0; flex: 1; overflow: auto; padding: 0 12px 14px; }
  .payment-checkout-note { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; color: var(--pay-muted); font-size: 11px; }
  .payment-checkout iframe { width: 100%; height: min(650px, 74dvh); border: 1px solid var(--pay-line); border-radius: 16px; background: white; }
  .payment-result { flex: 1; overflow-y: auto; padding: 18px 18px max(22px, env(safe-area-inset-bottom)); text-align: center; }
  .payment-result-icon {
    width: 84px;
    height: 84px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    animation: payment-pop .45s cubic-bezier(.2,.8,.3,1.25);
  }
  .payment-result-icon--success { background: #e4f3ea; color: #15824f; }
  .payment-result-icon--table { background: #f4ead2; color: #a9802c; }
  .payment-result-icon--error { background: #fde7e5; color: #b42318; }
  .payment-result h3 { margin: 16px 0 0; font-size: 23px; font-weight: 800; }
  .payment-result > p { max-width: 340px; margin: 6px auto 0; color: var(--pay-muted); font-size: 12.5px; line-height: 1.5; }
  .payment-receipt { margin: 20px 0 16px; padding: 16px; border-radius: 18px; background: var(--pay-card); box-shadow: 0 1px 2px rgba(20,22,20,.05), 0 8px 24px rgba(20,22,20,.05); text-align: left; }
  .payment-receipt-total { text-align: center; }
  .payment-receipt-total span { display: block; color: var(--pay-muted); font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
  .payment-receipt-total strong { display: block; margin-top: 3px; font-variant-numeric: tabular-nums; font-size: 32px; font-weight: 800; }
  .payment-receipt-line { margin: 14px 0 6px; border-top: 2px dashed var(--pay-line); }
  .payment-receipt-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--pay-line); font-size: 12px; }
  .payment-receipt-row:last-child { border-bottom: 0; }
  .payment-receipt-row span { color: var(--pay-muted); }
  .payment-receipt-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .payment-receipt-accent { color: #15824f; }
  .payment-error-note { display: block; margin: 18px 0; background: #fde7e5; color: #8f2018; font-size: 11.5px; line-height: 1.5; text-align: left; }
  .payment-secondary-action { width: 100%; height: 42px; margin-top: 8px; border: 0; background: transparent; color: var(--pay-muted); font-size: 12px; font-weight: 700; cursor: pointer; }
  .payment-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 999px; animation: payment-spin .7s linear infinite; }
  @keyframes payment-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes payment-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes payment-pop { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
  @keyframes payment-spin { to { transform: rotate(360deg); } }
  @media (min-width: 640px) {
    .payment-overlay { align-items: center; padding: 24px; }
    .payment-sheet { max-height: min(90vh, 850px); border-radius: 24px; }
  }
  @media (max-width: 380px) {
    .payment-name-grid { grid-template-columns: 1fr; gap: 0; }
    .payment-amount strong { font-size: 24px; }
  }
`
