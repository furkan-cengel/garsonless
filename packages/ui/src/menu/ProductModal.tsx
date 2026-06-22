'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MenuItem, ModifierGroup, SelectedModifier } from './types'
import { formatTRY } from './formatCurrency'
import { useTheme } from './ThemeContext'

interface ProductModalProps {
  item: MenuItem | null
  onClose: () => void
  onAddToCart: (item: MenuItem, modifiers: SelectedModifier[], quantity: number) => void
}

export function ProductModal({ item, onClose, onAddToCart }: ProductModalProps) {
  const { theme } = useTheme()
  const [selections, setSelections] = useState<Record<string, SelectedModifier[]>>({})
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!item) return
    setQuantity(1)
    // Pre-select defaults
    const defaults: Record<string, SelectedModifier[]> = {}
    for (const group of item.modifier_groups) {
      const defaultOpts = group.options
        .filter((o) => o.is_default)
        .map((o): SelectedModifier => ({ group_id: group.id, option_id: o.id }))
      if (defaultOpts.length > 0) defaults[group.id] = defaultOpts
    }
    setSelections(defaults)
  }, [item])

  if (!item) return null

  const isValid = item.modifier_groups.every((group) => {
    if (group.type !== 'required') return true
    return (selections[group.id]?.length ?? 0) >= (group.min || 1)
  })

  const allModifiers = Object.values(selections).flat()

  const modifierTotal = allModifiers.reduce((sum, sel) => {
    for (const group of item.modifier_groups) {
      const opt = group.options.find((o) => o.id === sel.option_id)
      if (opt) return sum + opt.price_delta * (sel.quantity ?? 1)
    }
    return sum
  }, 0)

  const totalPrice = (item.price + modifierTotal) * quantity

  const priceFormatted = formatTRY(totalPrice)

  const handleRadioChange = (group: ModifierGroup, optionId: string) => {
    setSelections((prev) => ({
      ...prev,
      [group.id]: [{ group_id: group.id, option_id: optionId }],
    }))
  }

  const handleCheckboxChange = (group: ModifierGroup, optionId: string, checked: boolean) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? []
      if (checked) {
        return { ...prev, [group.id]: [...current, { group_id: group.id, option_id: optionId }] }
      }
      return { ...prev, [group.id]: current.filter((s) => s.option_id !== optionId) }
    })
  }

  const handleAddToCart = () => {
    if (!isValid) return
    onAddToCart(item, allModifiers, quantity)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(15,23,42,.46)',
          backdropFilter: 'blur(2px)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="modal"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
          maxHeight: '90dvh',
          background: 'var(--p-card)',
          color: 'var(--p-text)',
          borderRadius: `${Math.max(theme.radius + 14, 24)}px ${Math.max(theme.radius + 14, 24)}px 0 0`,
          boxShadow: '0 -24px 70px rgba(15,23,42,.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(15,23,42,.08)',
          fontFamily: 'var(--p-body)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 999, background: 'rgba(15,23,42,.16)' }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {item.images[0] && (
            <div style={{ width: '100%', height: 210, overflow: 'hidden', background: 'linear-gradient(135deg, #f3f4f6, #e6e7eb)' }}>
              <img src={item.images[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          <div style={{ padding: 18 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--p-display)', fontSize: 24, lineHeight: 1.12, fontWeight: 800, color: 'var(--p-text)' }}>{item.name}</h2>
            {item.description && (
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--p-text-2)' }}>{item.description}</p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 20, fontWeight: 850, color: 'var(--p-accent)' }}>
              {formatTRY(item.price)}
            </p>
          </div>

          {item.modifier_groups.map((group) => (
            <div key={group.id} style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>{group.name}</p>
                {group.type === 'required' && (
                  <span
                    style={{
                      backgroundColor: 'var(--p-accent)',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Zorunlu
                  </span>
                )}
              </div>

              {group.options.map((opt) => {
                const isSelected = (selections[group.id] ?? []).some(
                  (s) => s.option_id === opt.id,
                )
                const priceDeltaStr =
                  opt.price_delta !== 0
                    ? (opt.price_delta > 0 ? '+' : '') + formatTRY(opt.price_delta)
                    : null

                return (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '9px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <input
                        type={group.type === 'required' ? 'radio' : 'checkbox'}
                        name={group.id}
                        checked={isSelected}
                        onChange={(e) => {
                          if (group.type === 'required') {
                            handleRadioChange(group, opt.id)
                          } else {
                            handleCheckboxChange(group, opt.id, e.target.checked)
                          }
                        }}
                        style={{ accentColor: 'var(--p-accent)', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
                    </div>
                    {priceDeltaStr && (
                      <span style={{ fontSize: 12, color: 'var(--p-text-2)', flexShrink: 0 }}>{priceDeltaStr}</span>
                    )}
                  </label>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: 18, borderTop: '1px solid rgba(15,23,42,.08)', background: 'rgba(255,255,255,.96)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--p-accent-soft)',
                  color: 'var(--p-accent)',
                  fontSize: 18,
                  fontWeight: 850,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
              <span style={{ minWidth: 24, textAlign: 'center', fontSize: 15, fontWeight: 850, color: 'var(--p-text)' }}>{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--p-cta)',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 850,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div>
            <span style={{ fontSize: 18, fontWeight: 850, color: 'var(--p-text)' }}>{priceFormatted}</span>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!isValid}
            style={{
              width: '100%',
              padding: '14px 0',
              border: 'none',
              borderRadius: Math.max(theme.radius + 4, 16),
              backgroundColor: 'var(--p-text)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 850,
              cursor: isValid ? 'pointer' : 'not-allowed',
              opacity: isValid ? 1 : 0.5,
              transition: 'opacity 150ms ease',
            }}
          >
            Sepete ekle
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
