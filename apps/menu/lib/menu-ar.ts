import type { PublishedMenuAr } from '@garsonless/application/menu-ar'
import type { MenuItem } from '@garsonless/ui/menu'

/** Adds each published model to its item; items without one stay unchanged. */
export function attachMenuAr(items: MenuItem[], models: PublishedMenuAr[]): MenuItem[] {
  if (models.length === 0) return items
  const byItem = new Map(models.map((model) => [model.menuItemId, model]))
  return items.map((item) => {
    const model = byItem.get(item.id)
    if (!model) return item
    const { menuItemId: _id, ...ar } = model
    return { ...item, ar }
  })
}

const MM_PER_CM = 10

/** "26 × 26 × 4,5 cm" from the stored millimetres; null when no size is known. */
export function formatMenuArSize(ar: Pick<NonNullable<MenuItem['ar']>, 'widthMm' | 'depthMm' | 'heightMm'>, locale: 'tr' | 'en' = 'tr'): string | null {
  const parts = [ar.widthMm, ar.depthMm, ar.heightMm].filter((value): value is number => value !== null)
  if (parts.length === 0) return null
  const format = (mm: number) => (mm / MM_PER_CM).toLocaleString(locale === 'en' ? 'en-GB' : 'tr-TR', { maximumFractionDigits: 1 })
  return `${parts.map(format).join(' × ')} cm`
}
