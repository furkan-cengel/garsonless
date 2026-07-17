import type React from 'react'
import type { Tables } from '@garsonless/db'
import {
  normalizeIngredients,
  normalizeModifierGroups,
  type MenuModifierGroup,
} from '@garsonless/db/browser'

const TINTS = ['#fce8d3', '#fde7c2', '#dcf0e1', '#fbd3c1', '#f5dcea', '#e7e3f0', '#d3eafc', '#e7f0dc']

export function tintFor(id: string): string {
  return TINTS[id.charCodeAt(0) % TINTS.length] ?? TINTS[0]!
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const lowerQ = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let last = 0
  let idx = lower.indexOf(lowerQ)
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(
      <mark key={idx} style={{ background: 'var(--accent-2)', color: 'var(--ink)', borderRadius: 2, padding: 0 }}>
        {text.slice(idx, idx + query.length)}
      </mark>,
    )
    last = idx + query.length
    idx = lower.indexOf(lowerQ, last)
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export function normalizeGroups(raw: unknown): MenuModifierGroup[] {
  return normalizeModifierGroups(raw).map((group) => ({
    ...group,
    id: group.id || crypto.randomUUID(),
    options: group.options.map((option) => ({ ...option, id: option.id || crypto.randomUUID() })),
  }))
}

export function getMissingProductInfo(item: Tables<'menu_items'>): string[] {
  return [
    !item.description?.trim() ? 'Açıklama' : null,
    !(Array.isArray(item.images) && item.images.length > 0) ? 'Görsel' : null,
    normalizeIngredients(item.ingredients).length === 0 ? 'İçindekiler' : null,
    item.energy_kcal == null ? 'Kalori' : null,
    item.food_info_reviewed_at == null ? 'Gıda bilgisi onayı' : null,
  ].filter((label): label is string => Boolean(label))
}
