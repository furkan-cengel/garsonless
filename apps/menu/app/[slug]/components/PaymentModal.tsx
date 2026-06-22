'use client'

import { useEffect, useState } from 'react'

interface Props {
  orderId: string
  total: number
  restaurantId: string
  deviceId: string
  onClose: () => void
  onSuccess: () => void
}

interface BuyerInfo {
  name: string
  surname: string
  email: string
  phone: string
}

export default function PaymentModal({
  orderId,
  total,
  restaurantId,
  deviceId,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<'form' | 'iframe' | 'success' | 'error'>('form')
  const [paymentPageUrl, setPaymentPageUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: '',
    surname: '',
    email: '',
    phone: '',
  })

  function updateBuyer(field: keyof BuyerInfo, value: string) {
    setBuyer((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmitBuyer(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          total,
          restaurantId,
          deviceId,
          buyerName: buyer.name,
          buyerSurname: buyer.surname,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phone,
        }),
      })
      const data = (await res.json()) as
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
      setErrorMsg('Ödeme başlatılamadı. Lütfen tekrar deneyin.')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (step !== 'iframe') return

    function handleIframeMessage(e: MessageEvent) {
      // The result message comes from our own callback page (same origin) —
      // ignore everything else (İyzico's own frames also postMessage).
      if (e.origin !== window.location.origin) return
      if (typeof e.data !== 'object' || e.data === null) return
      const msg = e.data as Record<string, unknown>
      if (msg['type'] === 'PAYMENT_SUCCESS') {
        setStep('success')
      } else if (msg['type'] === 'PAYMENT_FAILED') {
        setErrorMsg(
          typeof msg['reason'] === 'string' && msg['reason']
            ? msg['reason']
            : 'Ödeme başarısız. Lütfen tekrar deneyin.',
        )
        setStep('error')
      }
    }

    window.addEventListener('message', handleIframeMessage)
    return () => window.removeEventListener('message', handleIframeMessage)
  }, [step])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900 text-sm">
            {step === 'success' ? 'Ödeme Tamamlandı' : 'Ödeme Yap'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {step === 'form' && (
            <form onSubmit={handleSubmitBuyer} className="space-y-4">
              <p className="text-xs text-neutral-500">
                Toplam: <span className="font-semibold text-neutral-800">₺{total.toFixed(2)}</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">Ad</label>
                  <input
                    required
                    value={buyer.name}
                    onChange={(e) => updateBuyer('name', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-600">Soyad</label>
                  <input
                    required
                    value={buyer.surname}
                    onChange={(e) => updateBuyer('surname', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">E-posta</label>
                <input
                  type="email"
                  required
                  value={buyer.email}
                  onChange={(e) => updateBuyer('email', e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Telefon</label>
                <input
                  type="tel"
                  required
                  value={buyer.phone}
                  onChange={(e) => updateBuyer('phone', e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Yönlendiriliyor…' : 'Kartla Öde'}
              </button>
            </form>
          )}

          {step === 'iframe' && paymentPageUrl && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500 text-center">
                Güvenli ödeme sayfasına yönlendiriliyorsunuz…
              </p>
              <iframe
                src={paymentPageUrl}
                className="w-full rounded-xl border border-neutral-100"
                style={{ height: 500 }}
                title="İyzico Ödeme"
              />
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-semibold text-neutral-900">Ödeme başarılı!</p>
              <p className="text-xs text-neutral-500">Siparişiniz onaylandı.</p>
              <button
                type="button"
                onClick={onSuccess}
                className="mt-4 px-6 py-2 bg-neutral-900 text-white text-sm rounded-xl hover:bg-neutral-700 transition-colors"
              >
                Kapat
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">❌</div>
              <p className="font-semibold text-neutral-900">Hata</p>
              <p className="text-xs text-neutral-500">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="mt-4 px-6 py-2 border border-neutral-300 text-sm rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
