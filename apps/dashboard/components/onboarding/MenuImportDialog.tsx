'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, FileUpIcon, Trash2Icon } from 'lucide-react'
import { MENU_IMPORT_MAX_BYTES, MENU_IMPORT_MAX_PHOTOS, parseMenuImportRows, type MenuImportJob, type MenuImportRow } from '@garsonless/application/menu-import'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { importError, type useMenuImports } from './menu-import-client'

export const IMPORT_STATUS = { queued: 'Sıraya alındı', reading: 'Menün okunuyor', review: 'Kontrolüne hazır', applied: 'Menüne eklendi', failed: 'Menü okunamadı', cancelled: 'Aktarım kaldırıldı' }
type Controller = ReturnType<typeof useMenuImports>
export function MenuImportDialog({ open, onClose, controller }: { open: boolean; onClose: () => void; controller: Controller }) {
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [reviewDirty, setReviewDirty] = useState(false)
  const [closeWarning, setCloseWarning] = useState(false)
  const job = controller.snapshot?.jobs[0]
  // Either one PDF, or up to 10 photos of the printed menu (any phone size; they are shrunk before upload).
  function choose(next: File[]) {
    setFileError('')
    const pdfs = next.filter((file) => /\.pdf$/i.test(file.name))
    if (pdfs.length > 0 && (next.length > 1 || pdfs[0]!.size > MENU_IMPORT_MAX_BYTES)) {
      setFileError('Tek bir PDF (en fazla 3 MB) ya da fotoğraflar seç; ikisini birlikte gönderme.'); return
    }
    if (next.some((file) => !/\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(file.name) && !file.type.startsWith('image/'))) {
      setFileError('PDF ya da fotoğraf (JPG, PNG, WebP) seç.'); return
    }
    if (next.length > MENU_IMPORT_MAX_PHOTOS) { setFileError(importError('photo_limit')); return }
    setFiles(next)
  }
  function requestClose() { if (reviewDirty && job?.status === 'review') setCloseWarning(true); else onClose() }
  return <Dialog open={open} onOpenChange={value => { if (!value && !controller.busy) requestClose() }}>
    <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl" showCloseButton={!controller.busy}>
      <DialogHeader className="shrink-0 pr-8">
        <DialogTitle>{job ? IMPORT_STATUS[job.status] : 'Menünü dosyadan hazırlayalım'}</DialogTitle>
        <DialogDescription>{job ? job.filename : 'PDF veya fotoğraf yükle. Kategorileri, ürünleri ve fiyatları okuyalım; sen kontrol edip menüne ekle.'}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-1">
        {controller.error && <Alert variant="destructive"><AlertDescription>{controller.error}</AlertDescription></Alert>}
        {!job && <>
          <ol className="grid grid-cols-3 gap-3 text-sm text-muted-foreground" aria-label="Aktarım adımları"><li>1. Dosyanı yükle</li><li>2. Birlikte kontrol et</li><li>3. Menüne ekle</li></ol>
          <FieldGroup>
            <Field data-invalid={!!fileError}>
              <FieldLabel htmlFor="ai-menu-file">Menü fotoğrafları veya PDF</FieldLabel>
              <Input id="ai-menu-file" type="file" multiple accept="image/*,.pdf" disabled={controller.busy} aria-invalid={!!fileError}
                onChange={event => choose(Array.from(event.target.files ?? []))} />
              <FieldDescription>{files.length > 1 ? `${files.length} fotoğraf seçildi; seçtiğin sırayla sayfa olarak okunur.` : 'Her sayfanın fotoğrafını çek (en fazla 10) ya da tek bir PDF seç. Yazılar net ve düz görünmeli; en fazla 200 ürün.'}</FieldDescription>
            </Field>
          </FieldGroup>
          {fileError && <Alert variant="destructive"><AlertDescription>{fileError}</AlertDescription></Alert>}
          {controller.snapshot && !controller.snapshot.enabled && <Alert><AlertDescription>{importError('not_configured')}</AlertDescription></Alert>}
          <p className="text-sm text-muted-foreground">Dosyan menüyü okumak için AI hizmetine gönderilir. Okuma bittiğinde dosya sistemimizden silinir. Ürünler, sen onaylayana kadar menüne eklenmez.</p>
          <Button disabled={files.length === 0 || controller.busy || !controller.snapshot?.enabled} onClick={async () => { if (await controller.upload(files)) setFiles([]) }}>
            {controller.busy ? <Spinner data-icon="inline-start" /> : <FileUpIcon data-icon="inline-start" />}{controller.busy ? 'Yükleniyor…' : 'Menüyü oku'}
          </Button>
        </>}
        {job && (job.status === 'queued' || job.status === 'reading') && <>
          <Progress value={null} aria-label={IMPORT_STATUS[job.status]} />
          <ol className="flex flex-col gap-4 py-4 text-sm">
            <li className="flex items-center gap-2"><CheckIcon className="size-4" />Dosyan alındı</li>
            <li className="flex items-center gap-2"><Spinner />{job.status === 'queued' ? 'Okuma sırası bekleniyor' : 'Kategoriler, ürünler ve fiyatlar okunuyor'}</li>
            <li className="text-muted-foreground">Ardından ürünleri kontrol edeceksin</li>
          </ol>
          <p className="text-sm text-muted-foreground">Bu pencereyi kapatıp paneli kullanabilirsin. Aktarım arka planda devam eder; hazır olduğunda köşedeki karttan açabilirsin.</p>
        </>}
        {job?.status === 'review' && <ImportReview key={job.id} job={job} controller={controller} onDirty={setReviewDirty} />}
        {job?.status === 'failed' && <Alert variant="destructive"><AlertDescription>{importError(job.error ?? 'unavailable')}</AlertDescription></Alert>}
        {job?.status === 'applied' && <Alert><CheckIcon /><AlertDescription>{job.imported_count} ürün menüne eklendi. Ürün fotoğraflarını ve içerik bilgilerini Menü bölümünden tamamlayabilirsin.</AlertDescription></Alert>}
      </div>
      <DialogFooter className="shrink-0">
        {job && job.status !== 'review' && <Button variant="ghost" disabled={controller.busy} onClick={() => void controller.mutate(job, 'dismiss')}>{job.status === 'applied' || job.status === 'failed' ? 'Yeni dosya yükle' : 'Aktarımı iptal et'}</Button>}
        <Button variant="outline" disabled={controller.busy} onClick={requestClose}>{job?.status === 'queued' || job?.status === 'reading' ? 'Paneli keşfet' : 'Kapat'}</Button>
      </DialogFooter>
      <Dialog open={closeWarning} onOpenChange={setCloseWarning}><DialogContent><DialogHeader><DialogTitle>Kaydedilmemiş düzenlemeler var</DialogTitle><DialogDescription>Taslağı kaydetmek için geri dön. Kaydetmeden kapatırsan bu düzenlemeler kaybolur; dosyadan okunan ürünler korunur.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setCloseWarning(false)}>Düzenlemeye dön</Button><Button variant="destructive" onClick={() => { setCloseWarning(false); setReviewDirty(false); onClose() }}>Kaydetmeden kapat</Button></DialogFooter></DialogContent></Dialog>
    </DialogContent>
  </Dialog>
}

function ImportReview({ job, controller, onDirty }: { job: MenuImportJob; controller: Controller; onDirty: (value: boolean) => void }) {
  const router = useRouter()
  const [rows, setRows] = useState<MenuImportRow[]>(job.rows)
  // Retain the revision that these local edits started from: polling must not defeat CAS.
  const [baseJob, setBaseJob] = useState(job)
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [discard, setDiscard] = useState(false)
  const valid = parseMenuImportRows(rows, true) !== null
  function update(index: number, patch: Partial<MenuImportRow>) { setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)); setSaved(false); onDirty(true) }
  return <>
    <Alert><AlertDescription>Ürünleri ve TL fiyatlarını belgenle karşılaştır. Okunamayan fiyatları tamamla. Onayladığında bu ürünler müşteri menüsüne eklenir.</AlertDescription></Alert>
    <div className="flex items-center justify-between gap-3"><p className="text-sm">{rows.length} ürün · {rows.filter(row => row.price === null).length} eksik fiyat</p>
      <Button variant="outline" disabled={controller.busy || !parseMenuImportRows(rows)} onClick={async () => { const next = await controller.mutate(baseJob, 'save', rows); if (next) { setBaseJob(next); setSaved(true); onDirty(false) } }}>{saved ? 'Taslak kaydedildi' : 'Taslağı kaydet'}</Button>
    </div>
    {rows.map((row, index) => <Card key={index} className="shrink-0">
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Ürün {index + 1}</CardTitle>
        <Button variant="ghost" size="icon" aria-label={`${index + 1}. ürünü taslaktan kaldır`} disabled={controller.busy} onClick={() => { setRows(current => current.filter((_, i) => i !== index)); setSaved(false); onDirty(true) }}><Trash2Icon /></Button>
      </CardHeader>
      <CardContent><FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field><FieldLabel htmlFor={`import-category-${index}`}>Kategori</FieldLabel><Input id={`import-category-${index}`} value={row.category} maxLength={100} disabled={controller.busy} onChange={e => update(index, { category: e.target.value })} /></Field>
        <Field><FieldLabel htmlFor={`import-name-${index}`}>Ürün adı</FieldLabel><Input id={`import-name-${index}`} value={row.name} maxLength={100} disabled={controller.busy} onChange={e => update(index, { name: e.target.value })} /></Field>
        <Field><FieldLabel htmlFor={`import-description-${index}`}>Açıklama</FieldLabel><Input id={`import-description-${index}`} value={row.description} maxLength={500} disabled={controller.busy} onChange={e => update(index, { description: e.target.value })} /></Field>
        <Field data-invalid={row.price === null}><FieldLabel htmlFor={`import-price-${index}`}>Fiyat (TL)</FieldLabel><Input id={`import-price-${index}`} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={row.price ?? ''} disabled={controller.busy} aria-invalid={row.price === null} onChange={e => update(index, { price: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
      </FieldGroup></CardContent>
    </Card>)}
    <div className="flex flex-wrap justify-between gap-3">
      <Button variant="ghost" disabled={controller.busy} onClick={() => setDiscard(true)}>Bu taslağı kaldır</Button>
      <Button disabled={!valid || controller.busy} onClick={() => setConfirm(true)}>Kontrol ettim, {rows.length} ürünü ekle</Button>
    </div>
    <Dialog open={confirm || discard} onOpenChange={open => { if (!open && !controller.busy) { setConfirm(false); setDiscard(false) } }}>
      <DialogContent showCloseButton={!controller.busy}><DialogHeader><DialogTitle>{discard ? 'Aktarım taslağı kaldırılsın mı?' : 'Ürünler menüne eklensin mi?'}</DialogTitle><DialogDescription>{discard ? 'Bu dosyadan hazırlanan taslak kaldırılır. Mevcut menün korunur.' : `${rows.length} ürün müşteri menüsünde görünür olacak. Mevcut ürünlerin üzerine yazılmaz.`}</DialogDescription></DialogHeader>
        <DialogFooter className="shrink-0"><Button variant="outline" disabled={controller.busy} onClick={() => { setConfirm(false); setDiscard(false) }}>Geri dön</Button>
          <Button disabled={controller.busy} onClick={async () => { const result = await controller.mutate(baseJob, discard ? 'dismiss' : 'apply', rows); setConfirm(false); setDiscard(false); if (result) { onDirty(false); router.refresh() } }}>{controller.busy && <Spinner data-icon="inline-start" />}{discard ? 'Taslağı kaldır' : 'Menüye ekle'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
