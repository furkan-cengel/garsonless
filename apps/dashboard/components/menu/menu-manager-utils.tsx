import type React from 'react'
import type { Tables } from '@garsonless/db/types'
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

export type MissingProductField = 'description' | 'image' | 'ingredients' | 'energy' | 'review'

export type MissingProductInfo = { field: MissingProductField; label: string; consequence: string }

/** What a product still lacks, and what that means for the guest (or for the team). */
export function getMissingProductFields(item: Tables<'menu_items'>): MissingProductInfo[] {
  const missing: Array<MissingProductInfo | null> = [
    !item.description?.trim() ? { field: 'description', label: 'Açıklama', consequence: 'Misafir ürünün ne olduğunu sadece adından anlar.' } : null,
    !(Array.isArray(item.images) && item.images.length > 0) ? { field: 'image', label: 'Görsel', consequence: 'Menüde fotoğrafsız görünür.' } : null,
    normalizeIngredients(item.ingredients).length === 0 ? { field: 'ingredients', label: 'İçindekiler', consequence: 'Ürün detayında içerik listesi boş kalır.' } : null,
    item.energy_kcal == null ? { field: 'energy', label: 'Kalori', consequence: 'Ürün detayında enerji bilgisi gösterilmez.' } : null,
    item.food_info_reviewed_at == null ? { field: 'review', label: 'Gıda bilgisi onayı', consequence: 'İç kontrol: alerjen ve içerik beyanı henüz onaylanmadı.' } : null,
  ]
  return missing.filter((entry): entry is MissingProductInfo => entry !== null)
}

export function getMissingProductInfo(item: Tables<'menu_items'>): string[] {
  return getMissingProductFields(item).map((entry) => entry.label)
}

/**
 * Scroll only the editor's own scroll box. `scrollIntoView` would also scroll
 * every overflow ancestor and shift the whole dashboard shell.
 */
export function scrollWithinMenuEditor(target: HTMLElement, offset = 0) {
  const box = target.closest<HTMLElement>('.menu-item-editor-scroll')
  if (!box) return
  const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - offset
  box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

/**
 * Scroll the edit panel to a field and focus it. The panel is lazy-loaded, so
 * this waits up to ~1.5s for the anchor to appear.
 */
export function focusMenuField(itemId: string, field: MissingProductField) {
  let attempts = 0
  const tick = () => {
    const anchor = document.querySelector<HTMLElement>(`[data-menu-item-panel="${itemId}"] [data-menu-field="${field}"]`)
    if (!anchor) {
      if (attempts++ < 90) window.requestAnimationFrame(tick)
      return
    }
    scrollWithinMenuEditor(anchor, 96)
    const target = anchor.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button, [tabindex]:not([tabindex="-1"])')
    target?.focus({ preventScroll: true })
  }
  window.requestAnimationFrame(tick)
}
