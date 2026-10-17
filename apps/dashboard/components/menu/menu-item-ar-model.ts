import type { MenuArItemState, MenuArVersion } from '@garsonless/application/menu-ar'

/** Editable 3D/AR fields. Sizes stay as typed text (cm) until saved. */
export type MenuArForm = {
  glbAssetId: string | null
  glbUrl: string | null
  glbName: string
  usdzAssetId: string | null
  usdzName: string
  width: string
  depth: string
  height: string
  portionNote: string
}

export type MenuArStatus = 'none' | 'draft' | 'live' | 'live-changed'

export const MENU_AR_STATUS_COPY: Record<MenuArStatus, { label: string; tone: 'positive' | 'secondary' | 'warning' }> = {
  none: { label: 'Model yok', tone: 'secondary' },
  draft: { label: 'Taslak · menüde değil', tone: 'secondary' },
  live: { label: 'Menüde', tone: 'positive' },
  'live-changed': { label: 'Menüde · yeni taslak bekliyor', tone: 'warning' },
}

export function menuArStatus(state: Pick<MenuArItemState, 'draft' | 'publishedVersionId'>): MenuArStatus {
  if (!state.draft) return state.publishedVersionId ? 'live-changed' : 'none'
  if (!state.publishedVersionId) return 'draft'
  return state.publishedVersionId === state.draft.id ? 'live' : 'live-changed'
}

/** "12,5" → 125 mm. Empty is allowed (unknown size); anything else must be a number. */
export function parseCm(text: string): { ok: true; mm: number | null } | { ok: false } {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return { ok: true, mm: null }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false }
  return { ok: true, mm: Math.round(Number(trimmed) * 10) }
}

export function formatCm(mm: number | null): string {
  if (mm === null) return ''
  return (mm / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

export function menuArFormFromVersion(version: MenuArVersion | null): MenuArForm {
  return {
    glbAssetId: version?.glbAssetId ?? null,
    glbUrl: version?.glbUrl ?? null,
    glbName: version ? 'Kayıtlı GLB modeli' : '',
    usdzAssetId: version?.usdzAssetId ?? null,
    usdzName: version?.usdzAssetId ? 'Kayıtlı USDZ modeli' : '',
    width: formatCm(version?.widthMm ?? null),
    depth: formatCm(version?.depthMm ?? null),
    height: formatCm(version?.heightMm ?? null),
    portionNote: version?.portionNote ?? '',
  }
}

export function isMenuArFormDirty(form: MenuArForm, version: MenuArVersion | null): boolean {
  const saved = menuArFormFromVersion(version)
  return form.glbAssetId !== saved.glbAssetId
    || form.usdzAssetId !== saved.usdzAssetId
    || form.width.trim() !== saved.width
    || form.depth.trim() !== saved.depth
    || form.height.trim() !== saved.height
    || form.portionNote.trim() !== saved.portionNote
}

/** Only the restaurant's own public assets may become the AR poster. */
export function menuArPosterUrl(imageUrl: string | null | undefined, restaurantId: string): string | null {
  if (!imageUrl) return null
  return imageUrl.startsWith('https://') && imageUrl.includes(`/storage/v1/object/public/restaurant-assets/restaurants/${restaurantId}/`)
    ? imageUrl
    : null
}

export type MenuArSizeField = 'width' | 'depth' | 'height'

export function menuArDraftSizes(form: MenuArForm):
  | { ok: true; widthMm: number | null; depthMm: number | null; heightMm: number | null }
  | { ok: false; field: MenuArSizeField; error: string } {
  const sizes = { width: parseCm(form.width), depth: parseCm(form.depth), height: parseCm(form.height) }
  for (const field of ['width', 'depth', 'height'] as const) {
    const size = sizes[field]
    const min = field === 'height' ? 5 : 10
    if (!size.ok || (size.mm !== null && (size.mm < min || size.mm > 1000))) {
      return { ok: false, field, error: field === 'height' ? '0,5–100 cm arasında bir sayı girin.' : '1–100 cm arasında bir sayı girin.' }
    }
  }
  const mm = (field: MenuArSizeField) => (sizes[field] as { ok: true; mm: number | null }).mm
  return { ok: true, widthMm: mm('width'), depthMm: mm('depth'), heightMm: mm('height') }
}
