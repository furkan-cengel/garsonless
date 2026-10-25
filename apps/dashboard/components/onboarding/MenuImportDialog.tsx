'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CameraIcon, CheckIcon, ClockIcon, FileSpreadsheetIcon, FileTextIcon, ImageIcon, InfoIcon, LockIcon, PlusIcon, Trash2Icon, UploadIcon, XIcon } from 'lucide-react'
import { MENU_IMPORT_MAX_PHOTOS } from '@garsonless/application/menu-import'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { importError, openCsvImport, type useMenuImports } from './menu-import-client'
import { addFiles, formatBytes, formatWait, isPdf, moveFile, quotaLeft, selectionProblem, type SelectionNotice } from './menu-import-dialog-model'
import { MenuImportReview } from './MenuImportReview'
import { ImportSteps } from './MenuImportSteps'

export const IMPORT_STATUS = { queued: 'Sıraya alındı', reading: 'Menün okunuyor', review: 'Kontrolüne hazır', applied: 'Menüne eklendi', failed: 'Menü okunamadı', cancelled: 'Aktarım kaldırıldı' }
type Controller = ReturnType<typeof useMenuImports>
type View = 'loading' | 'disabled' | 'limit' | 'upload' | 'reading' | 'review' | 'applied' | 'failed'

const TITLE = 'AI ile menünü oluştur'
const DESCRIPTION = 'PDF veya fotoğraf yükle. Kategorileri, ürünleri ve fiyatları okuyalım; sen kontrol edip menüne ekle.'
const WIDTH: Record<View, string> = {
  loading: 'sm:max-w-[640px]', disabled: 'sm:max-w-[560px]', limit: 'sm:max-w-[560px]', upload: 'sm:max-w-[640px]',
  reading: 'sm:max-w-[640px]', review: 'sm:max-w-[920px] sm:h-[min(800px,88dvh)]', applied: 'sm:max-w-[560px]', failed: 'sm:max-w-[600px]',
}
// Provider-side failures do not depend on the photos, so a retry reads the same files again.
const SERVICE_ERRORS = new Set(['provider_busy', 'timeout', 'expired', 'unavailable'])

export function MenuImportDialog({ open, onClose, controller }: { open: boolean; onClose: () => void; controller: Controller }) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [notice, setNotice] = useState<SelectionNotice | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [changes, setChanges] = useState(0)
  const [closeWarning, setCloseWarning] = useState(false)
  const { snapshot, busy } = controller
  const job = snapshot?.jobs[0]
  const left = quotaLeft(snapshot?.quota)
  const view: View = !snapshot ? 'loading'
    : job?.status === 'queued' || job?.status === 'reading' ? 'reading'
    : job?.status === 'review' ? 'review'
    : job?.status === 'applied' ? 'applied'
    : job?.status === 'failed' ? 'failed'
    : !snapshot.enabled ? 'disabled'
    : left === 0 || controller.errorCode === 'quota_exceeded' ? 'limit'
    : 'upload'
  useEffect(() => { if (view !== 'review') { setConfirming(false); setChanges(0) } }, [view])
  const onDirtyChange = useCallback((count: number) => setChanges(count), [])

  function requestClose() {
    if (busy) return
    if (view === 'review' && changes > 0) setCloseWarning(true)
    else onClose()
  }
  async function dismiss() { if (job) await controller.mutate(job, 'dismiss') }
  async function read() { if (await controller.upload(files)) { setFiles([]); setNotice(null) } }
  function toCsv() { onClose(); openCsvImport() }

  return <Dialog open={open} onOpenChange={(value) => { if (!value) requestClose() }}>
    <DialogContent showCloseButton={!busy} className={`menu-sheet-dialog flex max-h-[88dvh] flex-col gap-4 ${view === 'review' && confirming ? 'sm:max-w-[560px]' : WIDTH[view]}`}>
      {view === 'loading' && <>
        <DialogHeader className="pr-8"><DialogTitle>{TITLE}</DialogTitle><DialogDescription>{DESCRIPTION}</DialogDescription></DialogHeader>
        <div className="flex items-center gap-2 py-6 text-muted-foreground" role="status"><Spinner />Hazırlanıyor…</div>
      </>}
      {view === 'upload' && <UploadView files={files} notice={notice} left={left} controller={controller}
        onFiles={(next, nextNotice) => { setFiles(next); setNotice(nextNotice); controller.clearError() }} onRead={() => void read()} onClose={requestClose} />}
      {view === 'reading' && job && <ReadingView job={job} busy={busy} error={controller.error} onCancel={() => void dismiss()} onClose={requestClose} />}
      {view === 'review' && job && <MenuImportReview key={job.id} job={job} controller={controller} confirming={confirming} onConfirming={setConfirming}
        onDirtyChange={onDirtyChange} onRequestClose={requestClose} onApplied={() => { setChanges(0); router.refresh() }} />}
      {view === 'applied' && job && <AppliedView job={job} left={left} busy={busy}
        onProducts={() => { onClose(); router.push(`/dashboard/${controller.restaurantId}/menu`) }} onNew={() => void dismiss()} onClose={requestClose} />}
      {view === 'failed' && job && <FailedView code={job.error ?? 'unavailable'} left={left} busy={busy} onCsv={toCsv} onClose={requestClose}
        onRetry={async () => {
          await dismiss()
          if (files.length && SERVICE_ERRORS.has(job.error ?? '')) await read()
        }} />}
      {view === 'limit' && <LimitView resetsAt={snapshot?.quota?.resetsAt ?? null} limit={snapshot?.quota?.limit ?? 5} onCsv={toCsv} onClose={requestClose} />}
      {view === 'disabled' && <DisabledView onCsv={toCsv} onClose={requestClose} />}

      <AlertDialog open={closeWarning} onOpenChange={setCloseWarning}>
        <AlertDialogContent className="menu-sheet-dialog">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[var(--warning-bg)] text-[var(--warning)]"><AlertTriangleIcon /></AlertDialogMedia>
            <AlertDialogTitle>Değişikliklerin kaybolacak</AlertDialogTitle>
            <AlertDialogDescription>Okunan listede {changes} düzenleme yaptın. Şimdi kapatırsan liste silinir; tekrar okumak bugünkü haklarından birini kullanır.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" className="border-[var(--critical-bg)] !text-[var(--critical)]" disabled={busy}
              onClick={async () => { await dismiss(); setCloseWarning(false); onClose() }}>Kapat ve sil</Button>
            <AlertDialogCancel autoFocus variant="default">Kontrole dön</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  </Dialog>
}

function PrivacyNote() {
  return <p className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
    <LockIcon className="mt-0.5 size-3.5 shrink-0" />Dosyan okuma bitince silinir. Ürünler sen onaylamadan menüne eklenmez.
  </p>
}

function quotaText(left: number | null) {
  return left === null ? '' : left === 1 ? 'Bugün son okuma hakkın' : `Bugün ${left} okuma hakkın var`
}

function SelectionAlert({ notice }: { notice: SelectionNotice }) {
  return <Alert role="alert" variant={notice.tone === 'error' ? 'destructive' : 'default'} className={notice.tone === 'warning' ? 'text-[var(--warning)]' : ''}>
    <AlertTriangleIcon />
    <AlertTitle>{notice.title}</AlertTitle>
    <AlertDescription className={notice.tone === 'warning' ? 'text-muted-foreground' : ''}>{notice.text}</AlertDescription>
  </Alert>
}

function UploadView({ files, notice, left, controller, onFiles, onRead, onClose }: {
  files: File[]
  notice: SelectionNotice | null
  left: number | null
  controller: Controller
  onFiles: (files: File[], notice: SelectionNotice | null) => void
  onRead: () => void
  onClose: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const problem = selectionProblem(files)
  const shown = problem ?? notice
  const single = files.length === 1 && isPdf(files[0]!)
  const previews = useMemo(() => files.map((file) => isPdf(file) ? '' : URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews])
  const busy = controller.busy

  function pick(picked: FileList | null) {
    if (!picked?.length) return
    const result = addFiles(files, Array.from(picked))
    onFiles(result.files, result.notice)
  }
  function remove(index: number) {
    onFiles(files.filter((_, i) => i !== index), null)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-import-tile="${Math.min(index, files.length - 2)}"]`)?.focus() ?? document.getElementById('import-add-photo')?.focus())
  }
  function move(from: number, to: number) {
    const next = moveFile(files, from, to)
    if (next === files) return
    onFiles(next, notice)
    setStatus(`Sayfa ${from + 1}, ${to + 1}. sıraya taşındı`)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-import-tile="${to}"]`)?.focus())
  }
  function tileKeys(event: KeyboardEvent, index: number) {
    if (!event.altKey) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(index, index - 1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(index, index + 1) }
  }
  function drop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files)
  }
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const summary = files.length ? `${single ? '1 PDF' : `${files.filter((file) => !isPdf(file)).length} fotoğraf`}${files.some(isPdf) && !single ? ' · 1 PDF' : ''} · ${formatBytes(total)}` : quotaText(left)

  return <>
    <DialogHeader className="pr-8">
      <DialogTitle>{TITLE}</DialogTitle>
      <DialogDescription><span className="max-sm:hidden">{DESCRIPTION}</span><span className="sm:hidden">Fotoğraf veya PDF yükle; okuyalım, sen kontrol et.</span></DialogDescription>
    </DialogHeader>
    <ImportSteps current={1} />
    <input ref={fileInput} type="file" multiple accept="image/*,application/pdf,.pdf,.heic,.heif" className="hidden" onChange={(event) => { pick(event.target.files); event.target.value = '' }} />
    <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { pick(event.target.files); event.target.value = '' }} />
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
      <span className="font-medium max-sm:hidden" id="import-files-label">{single ? 'Seçilen dosya' : 'Menü fotoğrafları veya PDF'}</span>
      <div className={shown?.tone === 'error' ? 'flex flex-col gap-2.5 rounded-[9px] border-[1.5px] border-[var(--critical)] p-2.5' : shown ? 'flex flex-col gap-2.5 rounded-[9px] border-[1.5px] border-[var(--warning)] p-2.5' : 'flex flex-col gap-2.5'}
        aria-invalid={shown?.tone === 'error' || undefined}>
        {shown && <SelectionAlert notice={shown} />}
        {files.length === 0 && <>
          <div role="button" tabIndex={0} aria-labelledby="import-files-label" aria-describedby="import-files-hint"
            onClick={() => fileInput.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.current?.click() } }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}
            className={`hidden min-h-[168px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[9px] border-[1.5px] border-dashed bg-muted/40 p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex ${dragging ? 'border-foreground' : 'border-border'}`}>
            <UploadIcon className="size-5" />
            <span className="text-[13.5px] font-semibold">Dosyaları buraya sürükle</span>
            <span className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); cameraInput.current?.click() }}><CameraIcon data-icon="inline-start" />Fotoğraf çek</Button>
              <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); fileInput.current?.click() }}>Dosya seç</Button>
            </span>
            <span className="text-xs text-muted-foreground">En fazla {MENU_IMPORT_MAX_PHOTOS} fotoğraf veya 1 PDF (en fazla 3 MB)</span>
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            <Button type="button" className="h-12" onClick={() => cameraInput.current?.click()}><CameraIcon data-icon="inline-start" />Fotoğraf çek</Button>
            <Button type="button" variant="outline" className="h-12" onClick={() => fileInput.current?.click()}>Galeriden veya dosyadan seç</Button>
          </div>
        </>}
        {single && <div className="flex items-center gap-2.5 rounded-[9px] border py-1.5 pr-1 pl-3">
          <span className="grid size-9 place-items-center rounded-lg bg-muted"><FileTextIcon className="size-[18px]" /></span>
          <span className="grid min-w-0 flex-1 gap-0.5"><span className="truncate font-medium">{files[0]!.name}</span><span className="text-xs text-muted-foreground">{formatBytes(files[0]!.size)}</span></span>
          <Button variant="ghost" size="icon" className="size-11 sm:size-8" aria-label={`${files[0]!.name} dosyasını kaldır`} disabled={busy} onClick={() => remove(0)}><Trash2Icon /></Button>
        </div>}
        {files.length > 0 && !single && <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-2.5" role="list" aria-label="Okunacak sayfalar">
          {files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} role="listitem" tabIndex={0} data-import-tile={index}
            aria-label={`Sayfa ${index + 1}: ${file.name}. Sırayı değiştirmek için Alt ve ok tuşları.`}
            draggable={!busy} onDragStart={() => setDragFrom(index)} onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (dragFrom !== null) move(dragFrom, index); setDragFrom(null) }}
            onKeyDown={(event) => tileKeys(event, index)}
            className={`relative aspect-[3/4] overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${isPdf(file) ? 'grid place-items-center bg-[var(--critical-bg)] p-2 text-center text-xs font-medium shadow-[inset_0_0_0_1.5px_var(--critical)]' : 'bg-muted'}`}>
            {isPdf(file)
              ? <span className="grid justify-items-center gap-1.5 text-[var(--critical)]"><FileTextIcon className="size-5" /><span className="line-clamp-2 break-all text-foreground">{file.name}</span></span>
              : previews[index] ? <img src={previews[index]} alt="" className="size-full object-cover" /> : <ImageIcon className="m-auto size-5 text-muted-foreground" />}
            {!isPdf(file) && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-background px-1.5 py-0.5 text-[11.5px] font-medium ring-1 ring-border">Sayfa {index + 1}</span>}
            <button type="button" aria-label={`Sayfa ${index + 1}'i kaldır`} disabled={busy} onClick={() => remove(index)}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background ring-1 ring-border max-sm:size-8">
              <XIcon className="size-3" />
            </button>
          </div>)}
          {files.length < MENU_IMPORT_MAX_PHOTOS && !files.some(isPdf) && <button id="import-add-photo" type="button" disabled={busy} onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()} onDrop={drop}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed bg-muted/40 text-center text-[12.5px] font-medium">
            <PlusIcon className="size-[18px]" />Fotoğraf ekle
          </button>}
        </div>}
      </div>
      <span id="import-files-hint" className="leading-snug text-muted-foreground max-sm:text-[12.5px]">
        {single ? 'PDF’in tüm sayfaları okunur. Fotoğraf eklemek için önce PDF’i kaldır.'
          : files.length > 1 ? 'Sayfalar bu sırayla okunur; sürükleyerek değiştirebilirsin.'
          : 'Her sayfanın ayrı fotoğrafını çek. Yazılar net ve düz görünsün; en fazla 200 ürün.'}
      </span>
      <span className="sr-only" aria-live="polite">{status}</span>
    </div>
    {controller.error && <Alert variant="destructive"><AlertDescription>{controller.error}</AlertDescription></Alert>}
    <PrivacyNote />
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground max-sm:hidden">{summary}</span>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" className="max-sm:hidden" disabled={busy} onClick={onClose}>Kapat</Button>
        <Button className="max-sm:h-11" disabled={!files.length || !!problem || busy} aria-describedby="import-files-hint" onClick={onRead}>
          {busy && <Spinner data-icon="inline-start" />}{busy ? 'Yükleniyor…' : notice?.tone === 'warning' && files.length === MENU_IMPORT_MAX_PHOTOS ? `${files.length} sayfayı oku` : 'Menüyü oku'}
        </Button>
      </div>
    </DialogFooter>
  </>
}

function useNow(interval: number, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval, active])
  return now
}

function ReadingView({ job, busy, error, onCancel, onClose }: {
  job: { status: string; created_at: string; filename: string }
  busy: boolean
  error: string
  onCancel: () => void
  onClose: () => void
}) {
  const now = useNow(1000)
  const elapsed = Math.max(0, (now - Date.parse(job.created_at)) / 1000)
  // The worker does not report pages, so progress follows the usual ~30 s read and never completes on its own.
  const progress = Math.min(92, Math.round(elapsed / 30 * 85))
  const slow = elapsed > 40
  return <>
    <DialogHeader className="pr-8">
      <DialogTitle><span className="max-sm:hidden">{TITLE}</span><span className="sm:hidden">Menün okunuyor</span></DialogTitle>
      <DialogDescription className="max-sm:hidden">{DESCRIPTION}</DialogDescription>
    </DialogHeader>
    <ImportSteps current={2} />
    <div className="flex flex-col gap-3.5 rounded-[9px] border bg-muted/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium"><Spinner />{job.status === 'queued' ? 'Okuma sırası bekleniyor' : 'Kategoriler, ürünler ve fiyatlar okunuyor'}</span>
        <span className="text-[12.5px] text-muted-foreground tabular-nums max-sm:hidden">{job.filename}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Okuma ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <span className="leading-snug text-muted-foreground max-sm:text-[12.5px]" aria-live="polite">
        {slow ? 'Biraz uzun sürüyor; birazdan hazır olur.' : 'Bu ~30 sn sürebilir. Pencereyi kapatabilirsin; hazır olunca sağ alttaki kartta göreceksin.'}
      </span>
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <PrivacyNote />
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground max-sm:hidden">{job.filename}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="ghost" className="max-sm:order-2 max-sm:h-11" disabled={busy} title="İptal edilen okuma hakkını geri vermez." onClick={onCancel}>Aktarımı iptal et</Button>
        <Button autoFocus variant="outline" className="max-sm:h-11" onClick={onClose}>Paneli keşfet</Button>
      </div>
    </DialogFooter>
  </>
}

function AppliedView({ job, left, busy, onProducts, onNew, onClose }: {
  job: { imported_count: number; rows: { category: string }[] }
  left: number | null
  busy: boolean
  onProducts: () => void
  onNew: () => void
  onClose: () => void
}) {
  const categories = new Set(job.rows.map((row) => row.category.trim().toLocaleLowerCase('tr-TR'))).size
  return <>
    <DialogHeader className="pr-8"><DialogTitle>{TITLE}</DialogTitle></DialogHeader>
    <ImportSteps current={3} done={3} />
    <div className="flex flex-col items-start gap-3" role="status">
      <span className="grid size-[38px] place-items-center rounded-[10px] bg-[var(--positive-bg)] text-[var(--positive)]"><CheckIcon className="size-5" /></span>
      <div className="grid gap-1.5">
        <p className="text-base font-medium">{job.imported_count} ürün menüne eklendi</p>
        <p className="text-muted-foreground">{categories ? `${categories} kategoriye yerleşti. ` : ''}Okunan dosyayı sildik.</p>
      </div>
    </div>
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[9px] border bg-muted/40 p-3 sm:grid-cols-[auto_1fr_auto]">
      <span className="grid size-9 place-items-center rounded-lg border bg-background"><ImageIcon className="size-[18px]" /></span>
      <span className="grid min-w-0 gap-0.5">
        <span className="font-medium">Ürün fotoğraflarını ve içerik bilgilerini ekle</span>
        <span className="text-[12.5px] leading-snug text-muted-foreground">Fotoğrafları biz eklemedik; alerjen ve içerik bilgileri de boş. Ürünleri açıp tamamlayabilirsin.</span>
      </span>
      <Button autoFocus className="max-sm:hidden" onClick={onProducts}>Ürünlere git</Button>
    </div>
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground max-sm:hidden">{left !== null && <><ClockIcon className="size-3.5" />{left ? `Bugün ${left} okuma hakkın kaldı` : 'Bugünkü okuma hakların doldu'}</>}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-11 sm:hidden" onClick={onProducts}>Ürünlere git</Button>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="ghost" className="max-sm:h-11 max-sm:border" disabled={busy} onClick={onNew}>Yeni dosya yükle</Button>
          <Button variant="outline" className="max-sm:h-11" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </DialogFooter>
  </>
}

function failureCopy(code: string) {
  if (code === 'unreadable_menu' || code === 'incomplete_output') return { title: 'Menüyü okuyamadık', text: 'Fotoğraflar bulanık ya da eğik olabilir. Işıklı bir yerde, sayfayı düz tutarak tekrar çek.' }
  if (code === 'too_many_items') return { title: 'Menü bir okuma için çok uzun', text: importError(code) }
  if (SERVICE_ERRORS.has(code)) return { title: 'Şu an okuyamıyoruz', text: 'Biraz sonra tekrar dene.' }
  return { title: 'Menüyü okuyamadık', text: importError(code) }
}

function CsvFallback({ title, text, action, onCsv }: { title: string; text: string; action: string; onCsv: () => void }) {
  return <div className="flex items-center gap-2.5 rounded-[9px] border bg-muted/40 p-3">
    <FileSpreadsheetIcon className="size-[18px] shrink-0" />
    <span className="grid flex-1 gap-0.5"><span className="font-medium">{title}</span><span className="text-[12.5px] text-muted-foreground">{text}</span></span>
    <Button variant="outline" className="max-sm:hidden" onClick={onCsv}>{action}</Button>
  </div>
}

function FailedView({ code, left, busy, onRetry, onCsv, onClose }: { code: string; left: number | null; busy: boolean; onRetry: () => void; onCsv: () => void; onClose: () => void }) {
  const copy = failureCopy(code)
  return <>
    <DialogHeader className="pr-8"><DialogTitle>{TITLE}</DialogTitle><DialogDescription className="max-sm:hidden">{DESCRIPTION}</DialogDescription></DialogHeader>
    <ImportSteps current={2} done={1} />
    <Alert variant="destructive" role="alert"><AlertTriangleIcon /><AlertTitle>{copy.title}</AlertTitle><AlertDescription>{copy.text}</AlertDescription></Alert>
    <CsvFallback title="Elinde tablo mu var?" text="CSV ile içe aktar; şablonu da indirebilirsin." action="CSV ile içe aktar" onCsv={onCsv} />
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground max-sm:hidden">Bu deneme hakkından düşmedi{left !== null ? ` · ${left} hak kaldı` : ''}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="ghost" className="max-sm:hidden" onClick={onClose}>Kapat</Button>
        <Button autoFocus className="max-sm:h-11" disabled={busy} onClick={onRetry}>{busy && <Spinner data-icon="inline-start" />}Tekrar dene</Button>
        <Button variant="outline" className="h-11 sm:hidden" onClick={onCsv}>CSV ile içe aktar</Button>
      </div>
    </DialogFooter>
  </>
}

function LimitView({ resetsAt, limit, onCsv, onClose }: { resetsAt: string | null; limit: number; onCsv: () => void; onClose: () => void }) {
  const now = useNow(60_000)
  const wait = formatWait(resetsAt, now)
  const at = resetsAt ? new Date(resetsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''
  return <>
    <DialogHeader className="pr-8"><DialogTitle>{TITLE}</DialogTitle><DialogDescription className="max-sm:hidden">{DESCRIPTION}</DialogDescription></DialogHeader>
    <ImportSteps current={1} done={0} />
    <Alert className="text-[var(--warning)]"><AlertTriangleIcon /><AlertTitle>Bugünkü {limit} okuma hakkını kullandın</AlertTitle>
      <AlertDescription className="text-muted-foreground">{wait ? `Bir sonraki hak ${wait} sonra açılır. ` : ''}Beklemek istemezsen menünü CSV ile aktarabilirsin.</AlertDescription>
    </Alert>
    <CsvFallback title="CSV ile içe aktar" text="Limitsiz; en fazla 1.000 ürün." action="CSV seç" onCsv={onCsv} />
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground max-sm:hidden">{at ? `Sonraki hak: ${at}` : ''}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button autoFocus className="h-11 sm:hidden" onClick={onCsv}>CSV ile içe aktar</Button>
        <Button variant="outline" className="max-sm:h-11 max-sm:border-0" onClick={onClose}>Kapat</Button>
      </div>
    </DialogFooter>
  </>
}

function DisabledView({ onCsv, onClose }: { onCsv: () => void; onClose: () => void }) {
  return <>
    <DialogHeader className="pr-8"><DialogTitle>{TITLE}</DialogTitle><DialogDescription className="max-sm:hidden">{DESCRIPTION}</DialogDescription></DialogHeader>
    <Alert><InfoIcon /><AlertTitle>AI ile oluşturma şu an kapalı</AlertTitle>
      <AlertDescription>Bu özellik henüz işletmen için açılmadı. Menünü CSV ile aktarabilir veya ürünlerini elle ekleyebilirsin.</AlertDescription>
    </Alert>
    <CsvFallback title="CSV ile içe aktar" text="Limitsiz; en fazla 1.000 ürün." action="CSV seç" onCsv={onCsv} />
    <DialogFooter>
      <Button autoFocus className="h-11 sm:hidden" onClick={onCsv}>CSV ile içe aktar</Button>
      <Button variant="outline" className="max-sm:h-11" onClick={onClose}>Kapat</Button>
    </DialogFooter>
  </>
}
