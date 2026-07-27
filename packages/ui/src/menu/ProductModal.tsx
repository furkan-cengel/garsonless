'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ALLERGEN_LABELS } from '@garsonless/db/browser'
import type { MenuItem, ModifierGroup, SelectedModifier } from './types'
import { formatTRY } from './formatCurrency'
import { useTheme } from './ThemeContext'
import { DietaryBadges, getDefiniteAllergens } from './FoodInfoBadges'

interface ProductModalProps {
  item: MenuItem | null
  onClose: () => void
  onAddToCart: (
    item: MenuItem,
    modifiers: SelectedModifier[],
    quantity: number,
    removedIngredientIds: string[],
  ) => void
  contextLabel?: string
  contextTitle?: string
  lockQuantity?: boolean
  submitLabel?: string
  closeAfterAdd?: boolean
}

export function ProductModal({ item, onClose, onAddToCart, contextLabel, contextTitle, lockQuantity = false, submitLabel, closeAfterAdd = true }: ProductModalProps) {
  const { theme } = useTheme()
  const [selections, setSelections] = useState<Record<string, SelectedModifier[]>>({})
  const [removedIngredientIds, setRemovedIngredientIds] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!item) return
    setQuantity(1)
    setRemovedIngredientIds([])
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

  useEffect(() => {
    if (!item) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, onClose])

  if (!item) return null

  const isValid = item.modifier_groups.every((group) => {
    const count = (selections[group.id] ?? []).reduce(
      (sum, selection) => sum + (group.selection_mode === 'quantity' ? (selection.quantity ?? 1) : 1),
      0,
    )
    return count >= group.min && count <= group.max
  })

  const allModifiers = Object.values(selections).flat()

  const modifierTotal = allModifiers.reduce((sum, sel) => {
    for (const group of item.modifier_groups) {
      const opt = group.options.find((o) => o.id === sel.option_id)
      if (opt) return sum + opt.price_delta * (sel.quantity ?? 1)
    }
    return sum
  }, 0)
  const calorieDelta = allModifiers.reduce((sum, sel) => {
    for (const group of item.modifier_groups) {
      const opt = group.options.find((o) => o.id === sel.option_id)
      if (opt) return sum + opt.calorie_delta * (sel.quantity ?? 1)
    }
    return sum
  }, 0)
  const selectedAllergens = new Set(getDefiniteAllergens(item))
  for (const group of item.modifier_groups) {
    for (const selection of selections[group.id] ?? []) {
      const option = group.options.find((candidate) => candidate.id === selection.option_id)
      for (const code of option?.allergen_codes ?? []) selectedAllergens.add(code)
    }
  }
  const energyKcal = item.energy_kcal === null
    ? null
    : Math.max(0, Math.round(item.energy_kcal + calorieDelta))
  const crossContactAllergens = item.may_contain_allergens.filter(
    (code) => !selectedAllergens.has(code),
  )

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
        if (current.length >= group.max) return prev
        return { ...prev, [group.id]: [...current, { group_id: group.id, option_id: optionId }] }
      }
      return { ...prev, [group.id]: current.filter((s) => s.option_id !== optionId) }
    })
  }

  const handleQuantityChange = (group: ModifierGroup, optionId: string, delta: number) => {
    setSelections((prev) => {
      const current = prev[group.id] ?? []
      const existing = current.find((selection) => selection.option_id === optionId)
      const groupTotal = current.reduce((sum, selection) => sum + (selection.quantity ?? 1), 0)
      const nextQuantity = Math.max(0, (existing?.quantity ?? 0) + delta)
      if (delta > 0 && groupTotal >= group.max) return prev
      const without = current.filter((selection) => selection.option_id !== optionId)
      return {
        ...prev,
        [group.id]: nextQuantity > 0
          ? [...without, { group_id: group.id, option_id: optionId, quantity: nextQuantity }]
          : without,
      }
    })
  }

  const handleAddToCart = () => {
    if (!isValid) return
    onAddToCart(item, allModifiers, quantity, removedIngredientIds)
    if (closeAfterAdd) onClose()
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
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
            {contextLabel && <div style={{ marginBottom: 5, color: 'var(--p-accent)', fontSize: 11, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase' }}>{contextLabel}</div>}
            {contextTitle && <div style={{ marginBottom: 12, color: 'var(--p-text-2)', fontSize: 13, fontWeight: 650 }}>{contextTitle}</div>}
            <h2 id="product-modal-title" style={{ margin: 0, fontFamily: 'var(--p-display)', fontSize: 24, lineHeight: 1.12, fontWeight: 800, color: 'var(--p-text)' }}>{item.name}</h2>
            {(item.is_vegan || item.is_vegetarian || item.is_halal) && (
              <div style={{ marginTop: 8 }}>
                <DietaryBadges item={item} />
              </div>
            )}
            {item.description && (
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--p-text-2)' }}>{item.description}</p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 20, fontWeight: 850, color: 'var(--p-accent)' }}>
              {formatTRY(item.price)}
            </p>
            {energyKcal !== null && (
              <span style={{
                display: 'inline-flex', marginTop: 10, padding: '4px 8px',
                borderRadius: 6, background: 'var(--p-accent-soft)',
                color: 'var(--p-accent)', fontSize: 12, fontWeight: 800,
              }}>
                {energyKcal} kcal / porsiyon
              </span>
            )}
          </div>

          {item.ingredients.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>İçindekiler</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {item.ingredients.map((ingredient) => (
                  <span key={ingredient.id} style={{
                    padding: '5px 8px', borderRadius: 6,
                    background: ingredient.allergen_codes.length > 0 ? '#fff2df' : 'var(--p-accent-soft)',
                    color: 'var(--p-text)', fontSize: 12,
                    fontWeight: ingredient.allergen_codes.length > 0 ? 800 : 600,
                  }}>
                    {ingredient.name}
                    {ingredient.amount ? (
                      <span style={{ marginLeft: 5, color: 'var(--p-text-2)', fontWeight: 600 }}>
                        · {ingredient.amount}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.ingredients.some((ingredient) => ingredient.removable) && (
            <div style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>Çıkarma tercihleri</p>
              {item.ingredients.filter((ingredient) => ingredient.removable).map((ingredient) => (
                <label key={ingredient.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                  fontSize: 14, cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={removedIngredientIds.includes(ingredient.id)}
                    onChange={(event) => setRemovedIngredientIds((current) =>
                      event.target.checked
                        ? [...current, ingredient.id]
                        : current.filter((id) => id !== ingredient.id),
                    )}
                    style={{ accentColor: 'var(--p-accent)' }}
                  />
                  <span>{ingredient.name} çıkarılsın</span>
                </label>
              ))}
            </div>
          )}

          {(item.contains_alcohol || item.contains_pork) && (
            <div data-component="special-content-warning" style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
                <p style={{ margin: '0 0 7px', fontSize: 13, fontWeight: 850 }}>Önemli içerik uyarısı</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {item.contains_alcohol && <span style={{ fontSize: 12, fontWeight: 800 }}>Alkol içerir</span>}
                  {item.contains_alcohol && item.contains_pork && <span aria-hidden="true">·</span>}
                  {item.contains_pork && <span style={{ fontSize: 12, fontWeight: 800 }}>Domuz kaynaklı bileşen içerir</span>}
                </div>
              </div>
            </div>
          )}

          {(selectedAllergens.size > 0 || item.allergen_note) && (
            <div data-component="contains-allergens" style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 850, color: '#7a4300' }}>Alerjenler · ürün içerir</p>
              <p style={{ margin: '4px 0 9px', fontSize: 11.5, lineHeight: 1.45, color: 'var(--p-text-2)' }}>
                {item.allergen_note || 'Bu alerjenler ürünün bileşenlerinde bulunur.'}
              </p>
              {selectedAllergens.size > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...selectedAllergens].map((code) => (
                  <span key={code} style={{ padding: '5px 8px', borderRadius: 6, background: '#fff2df', color: '#7a4300', fontSize: 11.5, fontWeight: 850 }}>
                    {ALLERGEN_LABELS[code]}
                  </span>
                ))}
              </div>}
            </div>
          )}

          {(crossContactAllergens.length > 0 || item.cross_contact_note) && (
            <div data-component="cross-contact-allergens" style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <div style={{ padding: 12, border: '1px dashed rgba(71,85,105,.38)', borderRadius: 8, background: 'rgba(241,245,249,.72)' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>Olası çapraz temas</p>
                <p style={{ margin: '4px 0 9px', fontSize: 11.5, lineHeight: 1.45, color: 'var(--p-text-2)' }}>
                  {item.cross_contact_note || 'Ürün eser miktarda aşağıdaki alerjenleri içerebilir.'}
                </p>
                {crossContactAllergens.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {crossContactAllergens.map((code) => (
                    <span key={code} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(71,85,105,.24)', color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 750 }}>
                      {ALLERGEN_LABELS[code]}
                    </span>
                  ))}
                </div>}
              </div>
            </div>
          )}

          {removedIngredientIds.length > 0 && (selectedAllergens.size > 0 || crossContactAllergens.length > 0) && (
            <div style={{ padding: '0 18px 14px' }}>
              <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--p-text-2)' }}>
                Bir içeriğin çıkarılması ürünün alerjensiz olduğunu garanti etmez.
              </p>
            </div>
          )}

          {item.modifier_groups.map((group) => (
            <div key={group.id} style={{ borderTop: '1px solid rgba(15,23,42,.08)', padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--p-text)' }}>{group.name}</p>
                {group.required && (
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
                      {group.selection_mode === 'quantity' ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <button type="button" aria-label={`${opt.name} azalt`} onClick={() => handleQuantityChange(group, opt.id, -1)} style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--p-accent-soft)', color: 'var(--p-accent)', cursor: 'pointer' }}>−</button>
                          <span style={{ minWidth: 16, textAlign: 'center', fontSize: 12, fontWeight: 800 }}>
                            {(selections[group.id] ?? []).find((selection) => selection.option_id === opt.id)?.quantity ?? 0}
                          </span>
                          <button type="button" aria-label={`${opt.name} artır`} onClick={() => handleQuantityChange(group, opt.id, 1)} style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'var(--p-accent)', color: '#fff', cursor: 'pointer' }}>+</button>
                        </div>
                      ) : (
                        <input
                          type={group.selection_mode === 'single' ? 'radio' : 'checkbox'}
                          name={group.id}
                          checked={isSelected}
                          onChange={(e) => {
                            if (group.selection_mode === 'single') handleRadioChange(group, opt.id)
                            else handleCheckboxChange(group, opt.id, e.target.checked)
                          }}
                          style={{ accentColor: 'var(--p-accent)', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontSize: 14, color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--p-text-2)', flexShrink: 0 }}>
                      {[priceDeltaStr, opt.calorie_delta !== 0 ? `${opt.calorie_delta > 0 ? '+' : ''}${opt.calorie_delta} kcal` : null].filter(Boolean).join(' · ')}
                    </span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: 18, borderTop: '1px solid rgba(15,23,42,.08)', background: 'rgba(255,255,255,.96)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            {!lockQuantity ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  color: 'var(--p-cta-text)',
                  fontSize: 18,
                  fontWeight: 850,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
            </div> : <span style={{ fontSize: 13, color: 'var(--p-text-2)', fontWeight: 700 }}>Kombo ürünü · 1 adet</span>}
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
            {submitLabel ?? 'Sepete ekle'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
