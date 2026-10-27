'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MenuImportJob, MenuImportRow } from '@garsonless/application/menu-import'

export const OPEN_SETUP_EVENT = 'masabu:open-guided-setup'
export const OPEN_MENU_IMPORT_EVENT = 'masabu:open-menu-import'
export function openGuidedSetup() { window.dispatchEvent(new Event(OPEN_SETUP_EVENT)) }
export function openMenuImport() { window.dispatchEvent(new Event(OPEN_MENU_IMPORT_EVENT)) }
/** The menu page listens for this to open its CSV import from the AI reader's fallback. */
export const OPEN_CSV_IMPORT_EVENT = 'masabu:open-csv-import'
export function openCsvImport() { window.dispatchEvent(new Event(OPEN_CSV_IMPORT_EVENT)) }

const IMPORT_ERRORS: Record<string, string> = {
  not_initialized: 'İçe aktarma henüz bu ortamda kullanıma açılmadı.',
  not_configured: 'AI menü okuma henüz kullanıma açılmadı. CSV ile aktarabilir veya ürünlerini elle ekleyebilirsin.',
  forbidden: 'Bu menüde işlem yapma yetkin yok.',
  file_too_large: 'En fazla 3 MB dosya yükleyebilirsin.',
  invalid_file: 'Dosya okunamadı. PDF, JPG, PNG veya WebP dosyası seç.',
  pdf_page_limit: 'Şifresiz, en fazla 10 sayfalık bir PDF seç.',
  photo_limit: 'En fazla 10 fotoğraf seçebilirsin. Daha uzun menüleri iki aktarıma böl.',
  quota_exceeded: 'Günlük aktarım sınırına ulaşıldı. Daha sonra tekrar dene.',
  active_job_exists: 'Devam eden aktarımı tamamla veya kaldır; ardından yeni dosya yükleyebilirsin.',
  revision_conflict: 'Taslak başka bir oturumda değişti. Düzenlemelerin burada duruyor. Güncel taslağı yeniden açarak karşılaştır.',
  menu_conflict: 'Bazı ürünler menüde zaten var veya eklenemedi. Hiçbir ürün eklenmedi. İlgili satırları kaldırıp yeniden dene.',
  invalid_rows: 'Kategori, ürün adı ve fiyatları kontrol et. Aktarım için her satırın fiyatı gerekli.',
  invalid_input: 'Bilgileri kontrol edip yeniden dene.',
  too_many_items: 'Dosyada 200’den fazla ürün var. Menüyü daha küçük dosyalara böl.',
  unreadable_menu: 'Menü okunamadı. Daha net bir fotoğraf veya PDF ile yeniden dene.',
  incomplete_output: 'Menünün tamamı okunamadı. Daha küçük bir dosya ile yeniden dene.',
  expired: 'İşlem zamanında tamamlanamadı. Dosyayı yeniden yükleyebilirsin.',
  timeout: 'Menü okuma zaman aşımına uğradı. Daha küçük bir dosya ile yeniden dene.',
  provider_busy: 'Menü okuma şu an yoğun. Daha sonra tekrar dene.',
}
export const importError = (code: string) => IMPORT_ERRORS[code] ?? 'İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.'
interface MenuImportQuota { limit: number; used: number; resetsAt: string | null }
export interface MenuImportSnapshot { jobs: MenuImportJob[]; enabled: boolean; itemCount: number; hasLogo: boolean; categories?: string[]; quota?: MenuImportQuota }

export function useMenuImports(restaurantId: string, allowed: boolean) {
  const [snapshot, setSnapshot] = useState<MenuImportSnapshot | null>(null)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [statusError, setStatusError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const generation = useRef(0)
  const pollInterval = useRef(30_000)
  const requestIdentity = useRef<{ files: File[]; id: string } | null>(null)
  const endpoint = `/api/menu-import?restaurantId=${encodeURIComponent(restaurantId)}`
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal })
      const data = await response.json()
      if (signal?.aborted || current !== generation.current) return
      if (!response.ok) { setStatusError(importError(data.error)); return }
      pollInterval.current = data.jobs?.some((job: MenuImportJob) => job.status === 'queued' || job.status === 'reading') ? 3000 : 30_000
      setSnapshot(data)
      setStatusError('')
    } catch { if (!signal?.aborted) setStatusError('Durum güncellenemedi. İşlem arka planda devam ediyor olabilir.') }
  }, [endpoint])
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (!document.hidden) await refresh(controller.signal)
      if (!controller.signal.aborted) timeout = setTimeout(() => void poll(), pollInterval.current)
    }
    void poll()
    const visible = () => { if (!document.hidden) void refresh(controller.signal) }
    document.addEventListener('visibilitychange', visible)
    return () => { controller.abort(); clearTimeout(timeout); document.removeEventListener('visibilitychange', visible) }
  }, [allowed, refresh])

  /** One PDF goes as is; photos are downscaled here and sent together to become one PDF on the server. */
  async function upload(files: File[]) {
    if (busyRef.current || files.length === 0) return false
    busyRef.current = true; setBusy(true); setError(''); setErrorCode('')
    const sameSelection = requestIdentity.current && requestIdentity.current.files.length === files.length && requestIdentity.current.files.every((file, index) => file === files[index])
    if (!sameSelection) requestIdentity.current = { files, id: crypto.randomUUID() }
    try {
      const single = files.length === 1 && /\.pdf$/i.test(files[0]!.name)
      let body: BodyInit
      const headers: Record<string, string> = { 'x-request-id': requestIdentity.current!.id }
      if (single) {
        body = files[0]!
        headers['Content-Type'] = 'application/octet-stream'
      } else {
        const form = new FormData()
        for (const [index, file] of files.entries()) form.append('photo', await downscalePhoto(file), `sayfa-${index + 1}.jpg`)
        body = form
      }
      const name = single ? files[0]!.name : `Menü fotoğrafları (${files.length})`
      const response = await fetch(`${endpoint}&filename=${encodeURIComponent(name)}`, { method: 'POST', body, headers })
      const data = await response.json()
      if (!response.ok) { setError(importError(data.error)); setErrorCode(data.error ?? ''); return false }
      await refresh()
      return true
    } catch { setError('Yükleme sonucu doğrulanamadı. Aynı dosyalarla tekrar deneyebilirsin; ikinci bir aktarım oluşturulmaz.'); return false }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function mutate(job: MenuImportJob, mode: 'save' | 'apply' | 'dismiss', rows?: MenuImportRow[]) {
    if (busyRef.current) return null
    busyRef.current = true; setBusy(true); setError(''); setErrorCode('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, revision: job.revision, mode, ...(rows ? { rows } : {}) }) })
      const data = await response.json()
      if (!response.ok) { setError(importError(data.error)); setErrorCode(data.error ?? ''); return null }
      if (mode === 'dismiss') requestIdentity.current = null
      await refresh()
      return data.job as MenuImportJob
    } catch { setError('İşlem sonucu doğrulanamadı. Aynı işlemi güvenle yeniden deneyebilirsin.'); return null }
    finally { busyRef.current = false; setBusy(false) }
  }
  function clearError() { setError(''); setErrorCode('') }
  return { restaurantId, snapshot, error: error || statusError, errorCode, busy, refresh, upload, mutate, clearError }
}

/** Phone photos are several MB; 1600px JPEG keeps printed menu text sharp at a fraction of the size. */
export async function downscalePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('photo_encode_failed')), 'image/jpeg', 0.85))
}
