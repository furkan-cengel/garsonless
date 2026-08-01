'use client'

import type { MenuItem } from './types'

export type DietaryFilter = 'vegan' | 'vegetarian' | 'halal'

const FILTERS: Array<{ id: DietaryFilter; label: string }> = [
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vejetaryen' },
  { id: 'halal', label: 'Helal' },
]

export function itemMatchesDietaryFilters(
  item: MenuItem,
  filters: readonly DietaryFilter[],
): boolean {
  return filters.every((filter) => {
    if (filter === 'vegan') return item.is_vegan === true
    if (filter === 'vegetarian') return item.is_vegetarian === true
    return item.is_halal === true
  })
}

export function DietaryFilterBar({
  selected,
  onToggle,
}: {
  selected: readonly DietaryFilter[]
  onToggle: (filter: DietaryFilter) => void
}) {
  return (
    <div
      data-component="dietary-filters"
      role="group"
      aria-label="Diyet filtreleri"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        overflowX: 'auto',
        padding: '10px var(--p-pad) 4px',
        scrollbarWidth: 'none',
      }}
    >
      {FILTERS.map((filter) => {
        const active = selected.includes(filter.id)
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(filter.id)}
            style={{
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 999,
              border: active ? '1px solid var(--p-accent)' : 'var(--p-border-w) solid var(--p-border)',
              background: active ? 'var(--p-accent)' : 'var(--p-card)',
              color: active ? '#fff' : 'var(--p-text-2)',
              fontFamily: 'var(--p-body)',
              fontSize: 12,
              fontWeight: 750,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
