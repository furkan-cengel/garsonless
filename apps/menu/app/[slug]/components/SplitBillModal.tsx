'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatTRY } from '@garsonless/ui'
import { createMenuBrowserClient } from '../../../lib/supabase'

const fmt = formatTRY

interface Props {
  restaurantId: string
  slug: string
  tableSessionId: string
  onClose: () => void
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

const SHARE_COLS = 'id, amount, method, status, label'

export default function SplitBillModal({ restaurantId, slug, tableSessionId, onClose }: Props) {
  const supabase = useMemo(() => createMenuBrowserClient(), [])
  const [shares, setShares] = useState<Share[]>([])
  const [orders, setOrders] = useState<SessionOrder[]>([])
  const [mode, setMode] = useState<'items' | 'free'>('items')
  const [picked, setPicked] = useState<Set<string>>(new Set()) // "orderId::idx" keys
  const [freeAmount, setFreeAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [payUrl, setPayUrl] = useState('') // İyzico iframe when paying by card

  const active = orders.filter((o) => o.status !== 'cancelled')
  const sessionTotal = active.reduce((s, o) => s + o.total, 0)
  const settled = shares.filter((s) => s.status === 'settled').reduce((s, x) => s + x.amount, 0)
  const declaredCash = shares.filter((s) => s.status === 'declared' && s.method === 'cash').reduce((s, x) => s + x.amount, 0)
  const remaining = Math.round((sessionTotal - settled) * 100) / 100

  // Live shares for this session (anon, session-filtered). Realtime respects the
  // column grant, so settled_by never reaches the client.
  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data } = await supabase.from('payment_shares').select(SHARE_COLS).eq('table_session_id', tableSessionId).neq('status', 'void')
      if (alive) setShares((data ?? []) as unknown as Share[])
    }
    void load()
    const ch = supabase
      .channel(`shares-${tableSessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_shares', filter: `table_session_id=eq.${tableSessionId}` }, () => void load())
      .subscribe()
    return () => { alive = false; void supabase.removeChannel(ch) }
  }, [supabase, tableSessionId])

  // Session orders (anon-granted columns: total + items) for the bill total and
  // item-based split. Refetched when an order updates (e.g. becomes paid).
  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data } = await supabase.from('orders').select('id, total, status, items').eq('table_session_id', tableSessionId).is('deleted_at', null)
      if (alive) setOrders((data ?? []) as unknown as SessionOrder[])
    }
    void load()
    const ch = supabase
      .channel(`splitorders-${tableSessionId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_session_id=eq.${tableSessionId}` }, () => void load())
      .subscribe()
    return () => { alive = false; void supabase.removeChannel(ch) }
  }, [supabase, tableSessionId])

  // Card success from the İyzico iframe → the callback settled the share; realtime
  // will refresh. Close the iframe.
  useEffect(() => {
    if (!payUrl) return
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string }
      if (m?.type === 'SHARE_PAYMENT_SUCCESS' || m?.type === 'PAYMENT_SUCCESS') { setPayUrl(''); setBusy(false) }
      else if (m?.type === 'PAYMENT_FAILED') { setPayUrl(''); setBusy(false); setError('Ödeme tamamlanamadı.') }
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

  async function createShare(method: 'iyzico' | 'cash'): Promise<string | null> {
    setError('')
    if (myAmount <= 0) { setError('Önce payını seç ya da tutar gir.'); return null }
    const bodyBase = { restaurantId, slug, tableSessionId, method, label: 'Payım' }
    const body = mode === 'items' ? { ...bodyBase, assignedItems: assignedItemsPayload() } : { ...bodyBase, amount: myAmount }
    const res = await fetch('/api/split/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const json = (await res.json()) as { success: boolean; data?: { shareId: string }; error?: string }
    if (!json.success || !json.data) { setError(json.error ?? 'Pay oluşturulamadı'); return null }
    return json.data.shareId
  }

  async function payByCard() {
    if (busy) return
    setBusy(true)
    const shareId = await createShare('iyzico')
    if (!shareId) { setBusy(false); return }
    const res = await fetch('/api/split/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shareId, restaurantId, slug, buyerName: 'Misafir', buyerSurname: 'Musteri', buyerEmail: 'guest@garsonless.app', buyerPhone: '+905000000000', deviceId: `dev-${Math.random().toString(36).slice(2)}` }),
    })
    const json = (await res.json()) as { success: boolean; data?: { paymentPageUrl: string }; error?: string }
    if (!json.success || !json.data) { setError(json.error ?? 'Ödeme başlatılamadı'); setBusy(false); return }
    setPayUrl(json.data.paymentPageUrl)
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
    : s.method === 'cash' ? 'Nakit — garson onayı bekliyor' : 'Kart bekliyor'
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
            <iframe src={payUrl} title="İyzico güvenli ödeme" className="w-full rounded-xl border border-neutral-200 bg-white" style={{ height: 'min(620px, 70dvh)' }} />
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
                {myAmount > remaining && <p className="text-xs text-amber-600">Payın kalan tutardan fazla — kartta kalan kadar tahsil edilir.</p>}
                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy || myAmount <= 0} onClick={declareCash}
                    className="py-3 text-sm font-medium rounded-xl border border-neutral-300 text-neutral-800 disabled:opacity-40">Nakit ödeyeceğim</button>
                  <button type="button" disabled={busy || myAmount <= 0} onClick={payByCard}
                    className="py-3 text-sm font-medium rounded-xl bg-neutral-900 text-white disabled:opacity-40">{busy ? '…' : 'Kartla öde'}</button>
                </div>
                <p className="text-[11px] text-neutral-400 text-center">Nakit beyanı ödeme sayılmaz — garson masada onaylar.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
