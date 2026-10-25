'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangleIcon, InfoIcon, Trash2Icon } from 'lucide-react'
import { parseMenuImportRows, type MenuImportJob } from '@garsonless/application/menu-import'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { groupRows, parsePrice, sameCategory, type ReviewRow } from './menu-import-dialog-model'
import { ImportSteps } from './MenuImportSteps'
import type { useMenuImports } from './menu-import-client'

type Controller = ReturnType<typeof useMenuImports>
const NEW_CATEGORY = '__new__'

/** Step 2 and 3 of the AI reader: edit the read list, then confirm what goes into the menu. */
export function MenuImportReview({ job, controller, confirming, onConfirming, onDirtyChange, onRequestClose, onApplied }: {
  job: MenuImportJob
  controller: Controller
  confirming: boolean
  onConfirming: (value: boolean) => void
  onDirtyChange: (changes: number) => void
  onRequestClose: () => void
  onApplied: () => void
}) {
  const original = useMemo(() => job.rows.map((row, key) => ({ ...row, key })), [job.rows])
  const [rows, setRows] = useState<ReviewRow[]>(original)
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const missing = rows.filter((row) => row.price === null)
  const ready = rows.filter((row) => row.price !== null)
  const payload = ready.map(({ key: _key, ...row }) => row)
  const valid = payload.length > 0 && parseMenuImportRows(payload, true) !== null
  const categories = useMemo(() => [...new Set(rows.map((row) => row.category.trim()).filter(Boolean))], [rows])
  const changes = rows.filter((row) => isEdited(row, original[row.key]!)).length + (original.length - rows.length)
  useEffect(() => onDirtyChange(changes), [changes, onDirtyChange])
  // When the last missing price is filled the filter has nothing left to show.
  const hadMissing = useRef(missing.length > 0)
  useEffect(() => {
    if (hadMissing.current && missing.length === 0) { setOnlyMissing(false); setAnnouncement('Tüm fiyatlar tamam') }
    hadMissing.current = missing.length > 0
  }, [missing.length])

  function update(key: number, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row))
  }
  function remove(row: ReviewRow) {
    setRows((current) => current.filter((entry) => entry.key !== row.key))
    toast.add({
      title: `${row.name} listeden çıkarıldı`,
      timeout: 5000,
      actionProps: { children: 'Geri al', onClick: () => setRows((current) => current.some((entry) => entry.key === row.key) ? current : [...current, row].sort((a, b) => a.key - b.key)) },
    })
  }
  async function apply() {
    const result = await controller.mutate(job, 'apply', payload)
    if (result) onApplied()
  }

  if (confirming) {
    const groups = groupRows(ready)
    const existing = controller.snapshot?.categories
    return <>
      <DialogHeader className="pr-8"><DialogTitle>Menüne eklemeden önce</DialogTitle></DialogHeader>
      <ImportSteps current={3} />
      <div className="flex flex-col gap-2.5">
        <p className="text-[15px] font-semibold">{ready.length} ürün, {groups.length} kategori menüne eklenecek.</p>
        <p className="text-muted-foreground">Mevcut ürünlerin değişmez. Aynı adlı kategoriler birleşir; yeni kategoriler listenin sonuna eklenir.</p>
      </div>
      <ul className="overflow-hidden rounded-lg border" aria-label="Eklenecek kategoriler">
        {groups.map((group) => <li key={group.category} className="flex items-center justify-between border-t px-3 py-2 text-[13px] first:border-t-0">
          <span className="flex items-center gap-1.5">{group.category}{existing && !existing.some((name) => sameCategory(name, group.category)) && <Badge variant="secondary">Yeni</Badge>}</span>
          <span className="text-muted-foreground tabular-nums">{group.items.length} ürün</span>
        </li>)}
      </ul>
      {missing.length > 0 && <p className="flex gap-2 text-[12.5px] text-[var(--warning)]"><AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />Fiyatı eksik {missing.length} ürün ({missing.slice(0, 3).map((row) => row.name).join(', ')}{missing.length > 3 ? '…' : ''}) eklenmeyecek.</p>}
      <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><InfoIcon className="size-3.5 shrink-0" />Eklenen ürünler hemen yayına çıkar; istersen sonra gizleyebilirsin.</p>
      <DialogFooter>
        <Button variant="outline" disabled={controller.busy} onClick={() => onConfirming(false)}>Geri dön</Button>
        <Button autoFocus disabled={controller.busy || !valid} onClick={() => void apply()}>{controller.busy ? <><Spinner data-icon="inline-start" />Ekleniyor…</> : 'Menüye ekle'}</Button>
      </DialogFooter>
    </>
  }

  const visible = onlyMissing ? rows.filter((row) => row.price === null) : rows
  return <>
    <DialogHeader className="pr-8">
      <DialogTitle>Okunan menünü kontrol et</DialogTitle>
      <DialogDescription>{job.filename} okundu. Ad, kategori ve fiyatı düzenleyebilir, gereksiz satırları silebilirsin.</DialogDescription>
    </DialogHeader>
    <ImportSteps current={2} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold">{rows.length} ürün · {categories.length} kategori</span>
        {ready.length > 0 && <Badge variant="positive" className="max-sm:hidden">{ready.length} hazır</Badge>}
        {missing.length > 0 && <Badge variant="warning">{missing.length} fiyat eksik</Badge>}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-[13px] font-medium sm:min-h-0">
        <Switch checked={onlyMissing} disabled={missing.length === 0} onCheckedChange={setOnlyMissing} />Yalnızca eksikleri göster
      </label>
    </div>
    <span className="sr-only" aria-live="polite">{announcement}</span>
    <div className="-mx-4 min-h-0 flex-1 overflow-y-auto border-t px-4 sm:mx-0 sm:rounded-lg sm:border sm:px-0">
      <div className="sticky top-0 z-[1] hidden grid-cols-[minmax(0,1fr)_180px_112px_32px] gap-2.5 border-b bg-muted px-3 py-2 text-[10.5px] font-medium tracking-[.05em] text-muted-foreground uppercase sm:grid">
        <span>Ürün</span><span>Kategori</span><span>Fiyat</span><span />
      </div>
      {groupRows(visible).map((group) => <section key={group.category} aria-label={group.category}>
        <h3 className="flex justify-between px-0.5 pt-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[.05em] text-muted-foreground uppercase sm:border-b sm:bg-muted/60 sm:px-3 sm:py-1.5">
          <span>{group.category}</span><span>{group.items.length} ürün</span>
        </h3>
        {group.items.map((row) => <ReviewRowEditor key={row.key} row={row} edited={isEdited(row, original[row.key]!)} categories={categories} disabled={controller.busy} onChange={(patch) => update(row.key, patch)} onRemove={() => remove(row)} />)}
      </section>)}
    </div>
    <DialogFooter className="sm:items-center sm:justify-between">
      <span className={`text-xs max-sm:order-1 ${missing.length ? 'flex items-center gap-1.5 text-[var(--warning)] max-sm:justify-center' : 'text-muted-foreground max-sm:hidden'}`}>
        {missing.length ? <><AlertTriangleIcon className="size-3.5" />Fiyatı eksik {missing.length} ürün eklenmez. Tamamla ya da sil.</> : `${ready.length} ürün eklenmeye hazır`}
      </span>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="outline" className="max-sm:hidden" disabled={controller.busy} onClick={onRequestClose}>Geri</Button>
        <Button className="max-sm:h-11" disabled={controller.busy || !valid} onClick={() => onConfirming(true)}>Kontrol ettim, {ready.length} ürünü ekle</Button>
      </div>
    </DialogFooter>
  </>
}

function isEdited(row: ReviewRow, original: ReviewRow) {
  return row.name !== original.name || row.description !== original.description || row.category !== original.category || row.price !== original.price
}

function ReviewRowEditor({ row, edited, categories, disabled, onChange, onRemove }: {
  row: ReviewRow
  edited: boolean
  categories: string[]
  disabled: boolean
  onChange: (patch: Partial<ReviewRow>) => void
  onRemove: () => void
}) {
  const [priceText, setPriceText] = useState(row.price === null ? '' : String(row.price).replace('.', ','))
  const [newCategory, setNewCategory] = useState(false)
  const missing = row.price === null
  const id = `import-row-${row.key}`
  return <div className={`mb-2 grid grid-cols-[minmax(0,1fr)_104px_44px] items-center gap-2 rounded-[10px] border p-3 sm:mb-0 sm:grid-cols-[minmax(0,1fr)_180px_112px_32px] sm:gap-2.5 sm:rounded-none sm:border-0 sm:border-b sm:px-3 sm:py-2 ${missing ? 'border-[var(--warning)] bg-[var(--warning-bg)] sm:shadow-[inset_3px_0_0_var(--warning)]' : 'bg-background'}`}>
    <div className="col-span-3 grid min-w-0 gap-px sm:col-span-1">
      <span className="flex items-center gap-1.5">
        <input id={`${id}-name`} aria-label="Ürün adı" value={row.name} maxLength={100} disabled={disabled} onChange={(event) => onChange({ name: event.target.value })}
          className="max-w-full min-w-0 rounded-sm bg-transparent font-medium outline-none [field-sizing:content] focus-visible:ring-2 focus-visible:ring-ring/50" />
        {edited && <span title="Düzenlendi" aria-label="Düzenlendi" className="size-1.5 shrink-0 rounded-full bg-[var(--info)]" />}
      </span>
      <input aria-label={`${row.name} açıklaması`} value={row.description} maxLength={500} disabled={disabled} placeholder="Açıklama yok" onChange={(event) => onChange({ description: event.target.value })}
        className="min-w-0 truncate rounded-sm bg-transparent text-[12.5px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50" />
    </div>
    {newCategory
      ? <Input autoFocus aria-label={`${row.name} için yeni kategori`} className="h-11 sm:h-8" maxLength={100} placeholder="Yeni kategori" disabled={disabled}
          onBlur={(event) => { if (event.target.value.trim()) onChange({ category: event.target.value.trim() }); setNewCategory(false) }}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setNewCategory(false) }} />
      : <NativeSelect aria-label={`${row.name} kategorisi`} className="w-full min-w-0 *:data-[slot=native-select]:h-11 sm:*:data-[slot=native-select]:h-8" value={row.category} disabled={disabled}
          onChange={(event) => event.target.value === NEW_CATEGORY ? setNewCategory(true) : onChange({ category: event.target.value })}>
          {categories.map((name) => <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>)}
          <NativeSelectOption value={NEW_CATEGORY}>Yeni kategori…</NativeSelectOption>
        </NativeSelect>}
    <div className="grid gap-0.5">
      <InputGroup className={`h-11 bg-background sm:h-8 ${missing ? 'border-[var(--warning)] ring-3 ring-[var(--warning)]/15' : ''}`}>
        <InputGroupAddon><InputGroupText>₺</InputGroupText></InputGroupAddon>
        <InputGroupInput aria-label={`${row.name} fiyatı`} aria-invalid={missing || undefined} inputMode="decimal" placeholder="Fiyat gir" value={priceText} disabled={disabled} className="tabular-nums"
          onChange={(event) => { setPriceText(event.target.value); onChange({ price: parsePrice(event.target.value) }) }} />
      </InputGroup>
      {missing && <span className="text-[11.5px] font-medium text-[var(--warning)] max-sm:hidden">Fiyat okunamadı</span>}
    </div>
    <Button variant="ghost" size="icon" className="size-11 border sm:size-8 sm:border-0" aria-label={`${row.name} ürününü sil`} disabled={disabled} onClick={onRemove}><Trash2Icon /></Button>
    {missing && <span className="col-span-3 text-xs font-medium text-[var(--warning)] sm:hidden">Fiyat okunamadı</span>}
  </div>
}
