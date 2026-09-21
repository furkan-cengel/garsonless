'use client'

import { useMenuLocale } from './MenuLocaleContext'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, SlidersHorizontal, X } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { resolveMenuFilterDefinitions, type MenuFilterDefinition } from './menuFilterModel'

export function DietaryFilterBar({
  selected,
  onToggle,
  onClear,
  onSelectionChange,
}: {
  selected: readonly MenuFilterDefinition[]
  onToggle: (filter: MenuFilterDefinition) => void
  onClear: () => void
  onSelectionChange: (filters: MenuFilterDefinition[]) => void
}) {
  const { t } = useMenuLocale();
  const { theme } = useTheme()
  const filters = useMemo(() => resolveMenuFilterDefinitions(theme), [theme])
  const selectedIds = useMemo(() => new Set(selected.map((filter) => filter.id)), [selected])
  const activeCount = filters.filter((filter) => selectedIds.has(filter.id)).length
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    const reconciled = selected.flatMap((selectedFilter) => {
      const current = filters.find((filter) => filter.id === selectedFilter.id)
      return current ? [current] : []
    })
    const unchanged = reconciled.length === selected.length && reconciled.every((filter, index) => {
      const previous = selected[index]
      if (!previous || filter.id !== previous.id || filter.label !== previous.label || filter.kind !== previous.kind) return false
      if (filter.kind !== 'custom' || previous.kind !== 'custom') return true
      return filter.itemIds.length === previous.itemIds.length && filter.itemIds.every((id, itemIndex) => id === previous.itemIds[itemIndex])
    })
    if (!unchanged) onSelectionChange(reconciled)
  }, [filters, onSelectionChange, selected])

  useEffect(() => {
    if (!open) return
    const closeFromOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('keydown', closeFromKeyboard)
    const frame = requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('keydown', closeFromKeyboard)
    }
  }, [open])

  if (filters.length === 0) return null

  return (
    <div
      ref={rootRef}
      data-component="menu-filters"
      style={{
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <style>{`
        [data-component="menu-filters"] button:focus-visible{outline:2px solid var(--p-accent);outline-offset:2px}
        @media (hover:hover) and (pointer:fine){
          [data-component="menu-filters"] [data-filter-trigger]:hover [data-filter-trigger-surface]{background:var(--p-accent-soft);border-color:var(--p-accent)}
          [data-component="menu-filters"] [data-filter-option]:hover{background:var(--p-accent-soft)}
        }
        @media (prefers-reduced-motion:reduce){
          [data-component="menu-filters"] [data-filter-trigger-surface]{transition:none!important}
        }
      `}</style>
      <button
        ref={triggerRef}
        data-filter-trigger
        type="button"
        aria-label={activeCount > 0 ? t("Filtreler, {count} seçili", { count: activeCount }) : t("Filtreleri aç")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: 44,
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: 0,
          borderRadius: 999,
          border: 0,
          background: 'transparent',
          color: activeCount > 0 ? 'var(--p-accent)' : 'var(--p-text-2)',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <span data-filter-trigger-surface style={{ width: 42, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: 'var(--p-border-w) solid var(--p-border)', background: activeCount > 0 ? 'var(--p-accent-soft)' : 'var(--p-card)', transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease', pointerEvents: 'none' }}>
          <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
        </span>
        {activeCount > 0 && (
          <span aria-hidden="true" style={{
            position: 'absolute',
            top: -4,
            right: -3,
            minWidth: 17,
            height: 17,
            padding: '0 4px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--p-accent)',
            color: 'var(--p-cta-text)',
            fontSize: 9,
            lineHeight: 1,
            fontWeight: 800,
            boxShadow: '0 0 0 2px var(--p-bg)',
          }}>{activeCount}</span>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label={t("Menü filtreleri")}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: 'min(276px, calc(100vw - (var(--p-pad) * 2)))',
            padding: 10,
            borderRadius: 14,
            border: 'var(--p-border-w) solid var(--p-border)',
            background: 'var(--p-card)',
            color: 'var(--p-text)',
            lineHeight: 'var(--p-line-body)',
            boxShadow: '0 18px 44px -20px rgba(10,15,20,.34)',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1px 2px 8px' }}>
            <strong style={{ flex: 1, fontSize: 'var(--p-text-md)', lineHeight: 'var(--p-line-tight)' }}>{t("Filtreler")}</strong>
            {activeCount > 0 && (
              <button type="button" onClick={onClear} style={{ border: 0, background: 'transparent', color: 'var(--p-accent)', font: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}>{t("Temizle")}</button>
            )}
            <button type="button" aria-label={t("Filtreleri kapat")} onClick={() => { setOpen(false); triggerRef.current?.focus() }} style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--p-text-2)', cursor: 'pointer', padding: 0 }}><span aria-hidden="true" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center' }}><X size={16} /></span></button>
          </div>
          <div role="group" aria-label={t("Ürün filtreleri")} style={{ display: 'grid', gap: 4 }}>
            {filters.map((filter) => {
              const active = selectedIds.has(filter.id)
              return (
                <button
                  key={filter.id}
                  data-filter-option
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(filter)}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '6px 8px',
                    border: 0,
                    borderRadius: 9,
                    background: active ? 'var(--p-accent-soft)' : 'transparent',
                    color: active ? 'var(--p-accent)' : 'var(--p-text-2)',
                    fontFamily: 'var(--p-body)',
                    fontSize: 'var(--p-text-sm)',
                    lineHeight: 'var(--p-line-body)',
                    fontWeight: active ? 750 : 650,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${active ? 'var(--p-accent)' : 'var(--p-border)'}`, background: active ? 'var(--p-accent)' : 'var(--p-card)', color: 'var(--p-cta-text)', flexShrink: 0 }}>
                    {active && <Check size={13} strokeWidth={2.5} />}
                  </span>
                  <span style={{ flex: 1 }}>{filter.kind === 'preset' ? t(filter.label) : filter.label}</span>
                  {filter.kind === 'custom' && <span style={{ color: 'var(--p-text-2)', fontSize: 10, fontWeight: 650 }}>{t("Özel")}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export type { MenuFilterDefinition } from './menuFilterModel'
export { itemMatchesDietaryFilters, itemMatchesMenuFilters, resolveMenuFilterDefinitions } from './menuFilterModel'

// Backward-compatible type name for preset-only callers.
export type DietaryFilter = 'vegan' | 'vegetarian' | 'halal'
