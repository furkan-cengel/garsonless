'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTRY } from '@garsonless/ui/menu'
import {
  readTrustedPaymentCallbackMessage,
  resolvePaymentCallbackOutcome,
} from '../../../lib/payment-callback-message'

const fmt = formatTRY

interface Props {
  slug: string
  tableToken: string
  tableSessionId: string
  deviceId: string
  initialBuyerName?: string | null
  onClose: () => void
}

interface BuyerInfo {
  name: string
  surname: string
  email: string
  phone: string
  identityNumber: string
}

interface SessionOrder { id: string; total: number; status: string; items: unknown }

// customer-safe columns only (settled_by / settled_at / customer_id are NOT
// granted to anon and must never be requested here).
interface Share {
  id: string
  amount: number
  method: 'iyzico' | 'cash' | null
  status: 'declared' | 'settled' | 'void'
  label: string | null
}
interface Line { itemId: string; name: string; price: number; quantity: number; modifiersPriceDelta: number }

function splitName(fullName?: string | null): Pick<BuyerInfo, 'name' | 'surname'> {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  return { name: parts[0] ?? '', surname: parts.slice(1).join(' ') }
}

export default function SplitBillModal({ slug, tableToken, tableSessionId, deviceId, initialBuyerName, onClose }: Props) {
  const initialName = splitName(initialBuyerName)
  const [shares, setShares] = useState<Share[]>([])
  const [orders, setOrders] = useState<SessionOrder[]>([])
  const [mode, setMode] = useState<'items' | 'free'>('items')
  const [picked, setPicked] = useState<Set<string>>(new Set()) // "orderId::idx" keys
  const [freeAmount, setFreeAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [payUrl, setPayUrl] = useState('') // İyzico iframe when paying by card
  const paymentFrameRef = useRef<HTMLIFrameElement>(null)
  const requestIntentRef = useRef<{ key: string; requestId: string } | null>(null)
  const [cardAvailability, setCardAvailability] = useState<'loading' | 'available' | 'unavailable'>('loading')
  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: initialName.name,
    surname: initialName.surname,
    email: '',
    phone: '',
    identityNumber: '',
  })

  const active = orders.filter((o) => o.status !== 'cancelled')
  const sessionTotal = active.reduce((s, o) => s + o.total, 0)
  const settled = shares.filter((s) => s.status === 'settled').reduce((s, x) => s + x.amount, 0)
  const declaredCash = shares.filter((s) => s.status === 'declared' && s.method === 'cash').reduce((s, x) => s + x.amount, 0)
  const remaining = Math.round((sessionTotal - settled) * 100) / 100

  const loadState = useCallback(async () => {
    const res = await fetch(`/api/table-state?token=${encodeURIComponent(tableToken)}`, { cache: 'no-store' })
    const body = await res.json() as { success: boolean; data?: { session: { id: string } | null; shares: Share[]; orders: SessionOrder[] } }
    if (!body.success || body.data?.session?.id !== tableSessionId) return
    setShares(body.data.shares)
    setOrders(body.data.orders)
  }, [tableToken, tableSessionId])

  useEffect(() => {
    let alive = true
    const load = async () => { if (alive) await loadState() }
    void load()
    const timer = window.setInterval(() => void load(), 3_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [loadState])

  useEffect(() => {
    let alive = true
    void fetch(`/api/split/availability?token=${encodeURIComponent(tableToken)}`, { cache: 'no-store' })
      .then(async (response) => response.json() as Promise<{ success: boolean; data?: { cardAvailable: boolean } }>)
      .then((result) => {
        if (alive) setCardAvailability(result.success && result.data?.cardAvailable ? 'available' : 'unavailable')
      })
      .catch(() => { if (alive) setCardAvailability('unavailable') })
    return () => { alive = false }
  }, [tableToken])

  // Card success from the İyzico iframe → the callback settled the share; realtime
  // will refresh. Close the iframe.
  useEffect(() => {
    if (!payUrl) return
    const onMsg = (e: MessageEvent) => {
      const message = readTrustedPaymentCallbackMessage(
        e,
        window.location.origin,
        paymentFrameRef.current?.contentWindow,
      )
      if (!message) return
      const outcome = resolvePaymentCallbackOutcome('share', message)
      if (outcome?.status === 'success') { setPayUrl(''); setBusy(false) }
      else if (outcome?.status === 'failed') { setPayUrl(''); setBusy(false); setError(outcome.reason) }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [payUrl])

  const lines: Array<{ key: string; orderId: string; line: Line }> = []
  for (const o of active) {
    const items = Array.isArray(o.items) ? (o.items as unknown as Line[]) : []
    items.forEach((l, idx) => lines.push({ key: `${o.id}::${idx}`, orderId: o.id, line: l }))
  }
  const lineAmount = (l: Line) => Math.max(0, l.price + l.modifiersPriceDelta) * (l.quantity > 0 ? l.quantity : 1)
  const myAmount = mode === 'items'
    ? lines.filter((x) => picked.has(x.key)).reduce((s, x) => s + lineAmount(x.line), 0)
    : Number(freeAmount) || 0

  function assignedItemsPayload() {
    return lines.filter((x) => picked.has(x.key)).map((x) => ({ orderId: x.orderId, itemId: x.line.itemId }))
  }

  function declarationBody(method: 'iyzico' | 'cash') {
    const declaration = mode === 'items'
      ? { assignedItems: assignedItemsPayload() }
      : { amount: myAmount }
    const key = JSON.stringify({ tableSessionId, method, ...declaration })
    const intent = requestIntentRef.current?.key === key
      ? requestIntentRef.current
      : { key, requestId: crypto.randomUUID() }
    requestIntentRef.current = intent
    return {
      ...declaration,
      slug,
      tableToken,
      tableSessionId,
      requestId: intent.requestId,
      label: 'Payım',
    }
  }

  function updateBuyer(field: keyof BuyerInfo, value: string) {
    setBuyer((current) => ({ ...current, [field]: value }))
  }

  function hasValidBuyer(): boolean {
    return Boolean(
      buyer.name.trim()
      && buyer.surname.trim()
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())
      && /^\+?[0-9 ()-]{7,20}$/.test(buyer.phone.trim())
      && /^[A-Za-z0-9]{5,32}$/.test(buyer.identityNumber.trim()),
    )
  }

  async function createShare(method: 'iyzico' | 'cash'): Promise<string | null> {
    setError('')
    if (myAmount <= 0) { setError('Önce payını seç ya da tutar gir.'); return null }
    const body = { ...declarationBody(method), method }
    const res = await fetch('/api/split/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const json = (await res.json()) as { success: boolean; data?: { shareId: string }; error?: string }
    if (!json.success || !json.data) { setError(json.error ?? 'Pay oluşturulamadı'); return null }
    return json.data.shareId
  }

  async function payByCard() {
    if (busy) return
    if (!hasValidBuyer()) {
      setError('Kartla ödeme için gerçek ad, iletişim ve kimlik/pasaport bilgilerini eksiksiz gir.')
      return
    }
    setBusy(true)
    setError('')
    const declaration = declarationBody('iyzico')
    try {
      const res = await fetch('/api/split/pay', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...declaration,
          buyerName: buyer.name.trim(),
          buyerSurname: buyer.surname.trim(),
          buyerEmail: buyer.email.trim(),
          buyerPhone: buyer.phone.trim(),
          buyerIdentityNumber: buyer.identityNumber.trim(),
          deviceId,
        }),
      })
      const json = (await res.json()) as { success: boolean; data?: { paymentPageUrl: string }; error?: string }
      if (!json.success || !json.data) { setError(json.error ?? 'Ödeme başlatılamadı'); setBusy(false); return }
      setPayUrl(json.data.paymentPageUrl)
    } catch {
      setError('Ödeme başlatılamadı. Bağlantını kontrol edip tekrar dene.')
      setBusy(false)
    }
  }

  async function declareCash() {
    if (busy) return
    setBusy(true)
    const shareId = await createShare('cash')
    setBusy(false)
    if (shareId) { setPicked(new Set()); setFreeAmount('') }
  }

  const statusText = (s: Share) =>
    s.status === 'settled' ? (s.method === 'cash' ? 'Nakit onaylandı' : 'Kart ödendi')
    : s.method === 'cash' ? 'Nakit - garson onayı bekliyor' : 'Kart bekliyor'
  const statusColor = (s: Share) => s.status === 'settled' ? 'text-emerald-600' : s.method === 'cash' ? 'text-amber-600' : 'text-neutral-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-neutral-900 text-sm">Hesabı böl</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Payını seç, kartla öde ya da nakit diyeceğini bildir.</p>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none">✕</button>
        </div>

        {payUrl ? (
          <div className="p-4">
            <p className="text-xs text-neutral-500 mb-2">Güvenli ödeme</p>
            <iframe ref={paymentFrameRef} src={payUrl} title="İyzico güvenli ödeme" className="w-full rounded-xl border border-neutral-200 bg-white" style={{ height: 'min(620px, 70dvh)' }} />
            <button type="button" onClick={() => { setPayUrl(''); setBusy(false) }} className="mt-3 w-full py-2.5 text-sm text-neutral-600 border border-neutral-200 rounded-xl">Vazgeç</button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Live status */}
            <div className="rounded-xl bg-neutral-50 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Hesap toplamı</span><span className="font-semibold text-neutral-900">{fmt(sessionTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Ödenen</span><span className="font-semibold text-emerald-600">{fmt(settled)}</span></div>
              {declaredCash > 0 && <div className="flex justify-between text-xs"><span className="text-amber-600">Nakit beyanı (onay bekliyor)</span><span className="text-amber-600">{fmt(declaredCash)}</span></div>}
              <div className="flex justify-between text-sm pt-1 border-t border-neutral-200"><span className="text-neutral-700 font-medium">Kalan</span><span className={`font-bold ${remaining <= 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>{fmt(Math.max(0, remaining))}</span></div>
              {shares.length > 0 && (
                <div className="pt-2 space-y-1">
                  {shares.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600">{s.label ?? 'Pay'} · {fmt(s.amount)}</span>
                      <span className={statusColor(s)}>{statusText(s)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {remaining <= 0 ? (
              <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm text-center py-4">Hesap tamamen ödendi 🎉</div>
            ) : (
              <>
                <div className="flex gap-2">
                  {(['items', 'free'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)}
                      className={['flex-1 py-2 text-xs font-medium rounded-lg border transition-colors', mode === m ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'].join(' ')}>
                      {m === 'items' ? 'Ürüne göre' : 'Tutar gir'}
                    </button>
                  ))}
                </div>

                {mode === 'items' ? (
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {lines.map(({ key, line }) => {
                      const on = picked.has(key)
                      return (
                        <label key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                          <input type="checkbox" checked={on} onChange={() => setPicked((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })} className="rounded" />
                          <span className="flex-1 text-xs text-neutral-700">{line.quantity}× {line.name}</span>
                          <span className="text-xs text-neutral-500">{fmt(lineAmount(line))}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-neutral-600">Ödeyeceğin tutar (₺)</label>
                    <input type="number" inputMode="decimal" min={0} max={remaining} value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)}
                      placeholder={`En fazla ${fmt(remaining)}`} className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm" />
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Senin payın</span>
                  <span className="font-bold text-neutral-900">{fmt(myAmount)}</span>
                </div>
                {myAmount > remaining && <p className="text-xs text-amber-600">Payın kalan tutardan fazla - kartta kalan kadar tahsil edilir.</p>}
                {cardAvailability !== 'unavailable' && (
                  <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
                    <p className="text-xs font-medium text-neutral-700">Kart ödeyen bilgileri</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input aria-label="Ad" autoComplete="given-name" maxLength={50} value={buyer.name} onChange={(event) => updateBuyer('name', event.target.value)} placeholder="Ad" className="h-10 px-3 rounded-lg border border-neutral-200 text-sm" />
                      <input aria-label="Soyad" autoComplete="family-name" maxLength={50} value={buyer.surname} onChange={(event) => updateBuyer('surname', event.target.value)} placeholder="Soyad" className="h-10 px-3 rounded-lg border border-neutral-200 text-sm" />
                    </div>
                    <input aria-label="E-posta" type="email" inputMode="email" autoComplete="email" maxLength={254} value={buyer.email} onChange={(event) => updateBuyer('email', event.target.value)} placeholder="E-posta" className="h-10 w-full px-3 rounded-lg border border-neutral-200 text-sm" />
                    <input aria-label="Telefon" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={buyer.phone} onChange={(event) => updateBuyer('phone', event.target.value)} placeholder="Telefon" className="h-10 w-full px-3 rounded-lg border border-neutral-200 text-sm" />
                    <input aria-label="T.C. kimlik / pasaport no" autoComplete="off" autoCapitalize="characters" spellCheck={false} minLength={5} maxLength={32} pattern="[A-Za-z0-9]+" value={buyer.identityNumber} onChange={(event) => updateBuyer('identityNumber', event.target.value)} placeholder="T.C. kimlik / pasaport no" className="h-10 w-full px-3 rounded-lg border border-neutral-200 text-sm" />
                    <p className="text-[11px] leading-4 text-neutral-400">Kimlik bilgisi yalnız ödeme için İyzico'ya aktarılır; masabu'da saklanmaz.</p>
                  </div>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className={`grid gap-2 ${cardAvailability === 'unavailable' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <button type="button" disabled={busy || myAmount <= 0} onClick={declareCash}
                    className="py-3 text-sm font-medium rounded-xl border border-neutral-300 text-neutral-800 disabled:opacity-40">Nakit ödeyeceğim</button>
                  {cardAvailability !== 'unavailable' && (
                    <button type="button" aria-busy={busy} disabled={busy || myAmount <= 0 || cardAvailability === 'loading'} onClick={payByCard}
                      className="py-3 text-sm font-medium rounded-xl bg-neutral-900 text-white disabled:opacity-40">
                      {busy ? 'Ödeme açılıyor…' : cardAvailability === 'loading' ? 'Kart kontrol ediliyor…' : 'Kartla öde'}
                    </button>
                  )}
                </div>
                {cardAvailability === 'unavailable' && (
                  <p className="text-[11px] text-neutral-500 text-center">Kartla ödeme bu işletmede aktif değil.</p>
                )}
                <p className="text-[11px] text-neutral-400 text-center">Nakit beyanı ödeme sayılmaz - garson masada onaylar.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
