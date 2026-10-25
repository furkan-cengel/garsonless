import { MENU_IMPORT_MAX_BYTES, MENU_IMPORT_MAX_PHOTOS, type MenuImportRow } from '@garsonless/application/menu-import'

/* Pure rules behind the AI menu reader dialog, kept out of the component so they can be tested. */

const PHOTO_MAX_BYTES = 20 * 1024 * 1024
const PHOTO_PATTERN = /\.(jpe?g|png|webp|heic|heif)$/i

export const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
const isPhoto = (file: File) => file.type.startsWith('image/') || PHOTO_PATTERN.test(file.name)

export interface SelectionNotice { tone: 'error' | 'warning'; title: string; text: string }

/** Adds newly picked files to the selection: unsupported files are dropped, photos beyond 10 are cut. */
export function addFiles(current: File[], picked: File[]): { files: File[]; notice: SelectionNotice | null } {
  const supported = picked.filter((file) => isPdf(file) || isPhoto(file))
  let notice: SelectionNotice | null = supported.length < picked.length
    ? { tone: 'error', title: 'Desteklenmeyen dosya', text: 'Yalnızca JPG, PNG, WebP, HEIC veya PDF yükleyebilirsin.' }
    : null
  let files = [...current, ...supported]
  if (!files.some(isPdf) && files.length > MENU_IMPORT_MAX_PHOTOS) {
    notice = { tone: 'warning', title: `En fazla ${MENU_IMPORT_MAX_PHOTOS} fotoğraf`, text: `${files.length} seçtin; ilk ${MENU_IMPORT_MAX_PHOTOS} tanesini aldık. Kalan sayfalar için ikinci bir okuma yap.` }
    files = files.slice(0, MENU_IMPORT_MAX_PHOTOS)
  }
  return { files, notice }
}

/** A selection that cannot be read as is; the read button stays off until it is fixed. */
export function selectionProblem(files: File[]): SelectionNotice | null {
  const pdf = files.find(isPdf)
  if (pdf && files.length > 1) return { tone: 'error', title: 'PDF ile fotoğraf birlikte okunamaz', text: 'PDF’i kaldır ya da yalnızca fotoğraflarla devam et.' }
  if (pdf && pdf.size > MENU_IMPORT_MAX_BYTES) return { tone: 'error', title: 'Dosya çok büyük', text: `${pdf.name} 3 MB’tan büyük. PDF’i küçült ya da sayfaların fotoğrafını çek.` }
  const large = files.find((file) => !isPdf(file) && file.size > PHOTO_MAX_BYTES)
  if (large) return { tone: 'error', title: 'Dosya çok büyük', text: `${large.name} 20 MB’tan büyük. Daha düşük çözünürlükte çek.` }
  return null
}

export function moveFile(files: File[], from: number, to: number) {
  if (to < 0 || to >= files.length || from === to) return files
  const next = [...files]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

export function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`
}

/** "14 sa 12 dk" until the next read frees up; at least one minute. */
export function formatWait(resetsAt: string | null, now: number) {
  if (!resetsAt) return ''
  const minutes = Math.max(1, Math.ceil((Date.parse(resetsAt) - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} sa ${minutes % 60} dk` : `${minutes} dk`
}

export function quotaLeft(quota: { limit: number; used: number } | undefined) {
  return quota ? Math.max(0, quota.limit - quota.used) : null
}

export type ReviewRow = MenuImportRow & { key: number }

/** Category groups in the order the menu lists them, each keeping the rows' positions. */
export function groupRows(rows: ReviewRow[]) {
  const groups = new Map<string, ReviewRow[]>()
  for (const row of rows) {
    const name = row.category.trim() || 'Kategorisiz'
    groups.set(name, [...(groups.get(name) ?? []), row])
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
}

export function parsePrice(text: string) {
  const normalized = text.replace(/\s|₺/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

export const sameCategory = (a: string, b: string) => a.trim().toLocaleLowerCase('tr-TR') === b.trim().toLocaleLowerCase('tr-TR')
