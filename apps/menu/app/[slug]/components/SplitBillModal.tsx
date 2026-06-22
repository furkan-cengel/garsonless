'use client'

import { useState } from 'react'
import { formatTRY } from '@garsonless/ui'
import type { CartItem } from '@garsonless/ui'

interface Props {
  items: CartItem[]
  subtotal: number
  restaurantId: string
  deviceId: string
  onClose: () => void
}

interface Person {
  id: number
  name: string
  itemIds: string[]
}

const fmt = formatTRY

function personTotal(person: Person, items: CartItem[]): number {
  return person.itemIds.reduce((sum, cartId) => {
    const item = items.find((i) => i.cartId === cartId)
    if (!item) return sum
    return sum + (item.price + item.modifiersPriceDelta) * item.quantity
  }, 0)
}

export default function SplitBillModal({ items, subtotal, onClose }: Props) {
  const [personCount, setPersonCount] = useState(2)
  const [persons, setPersons] = useState<Person[]>([
    { id: 1, name: 'Kişi 1', itemIds: [] },
    { id: 2, name: 'Kişi 2', itemIds: [] },
  ])
  const [mode, setMode] = useState<'equal' | 'items'>('equal')

  function updatePersonCount(count: number) {
    setPersonCount(count)
    setPersons((prev) => {
      const next = Array.from({ length: count }, (_, i) => {
        return prev[i] ?? { id: i + 1, name: `Kişi ${i + 1}`, itemIds: [] }
      })
      return next
    })
  }

  function toggleItemForPerson(personId: number, cartId: string) {
    setPersons((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p
        const has = p.itemIds.includes(cartId)
        return { ...p, itemIds: has ? p.itemIds.filter((id) => id !== cartId) : [...p.itemIds, cartId] }
      }),
    )
  }

  const equalShare = subtotal / personCount

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900 text-sm">Hesabı Böl</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['equal', 'items'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  'flex-1 py-2 text-xs font-medium rounded-lg border transition-colors',
                  mode === m
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50',
                ].join(' ')}
              >
                {m === 'equal' ? 'Eşit Böl' : 'Ürüne Göre Böl'}
              </button>
            ))}
          </div>

          {/* Person count */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-neutral-600">Kişi sayısı:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updatePersonCount(Math.max(2, personCount - 1))}
                className="h-7 w-7 rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 flex items-center justify-center text-sm"
              >
                −
              </button>
              <span className="text-sm font-semibold text-neutral-800 w-4 text-center">
                {personCount}
              </span>
              <button
                type="button"
                onClick={() => updatePersonCount(Math.min(10, personCount + 1))}
                className="h-7 w-7 rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50 flex items-center justify-center text-sm"
              >
                +
              </button>
            </div>
          </div>

          {mode === 'equal' ? (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">
                Toplam: <span className="font-semibold text-neutral-800">{fmt(subtotal)}</span>
              </p>
              <div className="grid gap-2">
                {persons.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl"
                  >
                    <span className="text-sm text-neutral-700">{p.name}</span>
                    <span className="text-sm font-semibold text-neutral-900">{fmt(equalShare)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {persons.map((person) => (
                <div key={person.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700">{person.name}</span>
                    <span className="text-xs text-neutral-500">
                      {fmt(personTotal(person, items))}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const checked = person.itemIds.includes(item.cartId)
                      return (
                        <label
                          key={item.cartId}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItemForPerson(person.id, item.cartId)}
                            className="rounded"
                          />
                          <span className="flex-1 text-xs text-neutral-700">
                            {item.quantity}× {item.name}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {fmt((item.price + item.modifiersPriceDelta) * item.quantity)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-neutral-400 text-center">
            Her kişi kendi ödeme sayfasından kartıyla ödeme yapabilir.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
