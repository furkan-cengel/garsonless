'use client'

import { useState, useTransition } from 'react'
import { generateKitchenToken } from '../../lib/actions/restaurant'
import { S } from '../../lib/ui'

interface Props {
  restaurantId: string
  existingToken?: string | null
}

export default function KitchenAccessSection({ restaurantId, existingToken }: Props) {
  const [token, setToken] = useState(existingToken ?? '')
  const [kitchenUrl, setKitchenUrl] = useState(
    existingToken
      ? `${process.env['NEXT_PUBLIC_KITCHEN_URL'] ?? 'http://localhost:3002'}/kitchen/${restaurantId}?token=${existingToken}`
      : '',
  )
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleGenerate() {
    setError('')
    startTransition(async () => {
      const result = await generateKitchenToken(restaurantId)
      if ('error' in result) { setError(result.error); return }
      setToken(result.token)
      setKitchenUrl(result.kitchenUrl)
      setQrDataUrl(result.qrDataUrl)
    })
  }

  function handleCopy() {
    navigator.clipboard?.writeText(kitchenUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ paddingTop: 20, borderTop: '1px solid var(--divider)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Mutfak Erişimi</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
          Bu URL&apos;yi mutfak tabletinizle paylaşın. Giriş gerekmez.
        </div>
      </div>

      {token && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              readOnly
              value={kitchenUrl}
              style={{
                flex: 1, height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 7,
                background: 'var(--surface-2)', color: 'var(--text-2)',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
                ...S.mono,
              }}
            />
            <button
              type="button"
              onClick={handleCopy}
              style={{
                height: 34, padding: '0 12px', flexShrink: 0,
                border: '1px solid var(--border)', borderRadius: 7,
                background: copied ? 'var(--positive-bg)' : 'var(--surface)',
                color: copied ? 'var(--positive)' : 'var(--text-2)',
                fontSize: 12.5, cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              {copied ? '✓ Kopyalandı' : 'Kopyala'}
            </button>
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Kitchen QR"
              style={{ width: 120, height: 120, borderRadius: 10, border: '1px solid var(--border)' }}
            />
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--critical)', marginBottom: 12 }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        style={{
          height: 36, padding: '0 16px', borderRadius: 7,
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          color: 'var(--text)', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', opacity: isPending ? 0.55 : 1,
        }}
      >
        {isPending ? 'Oluşturuluyor…' : token ? 'Token yenile' : 'Mutfak token\'ı oluştur'}
      </button>
    </div>
  )
}
