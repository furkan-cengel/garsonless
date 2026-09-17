'use client'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'
import { bulkPrice } from '@garsonless/domain/menu-bulk'
import type { Tables } from '@garsonless/db/types'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { MenuBulkSelect } from './MenuBulkSelect'
import type { BulkDraft } from './menu-bulk-editor-model'

export const MenuBulkFields = memo(function MenuBulkFields({ id, value, original, categories, onChange, onRemove, invalid }: {
  id: string; value: BulkDraft; original: BulkDraft; categories: Tables<'menu_categories'>[]; invalid: boolean
  onChange: (id: string, patch: Partial<BulkDraft>) => void; onRemove: (id: string) => void
}) {
  let priceError = ''
  try { bulkPrice(value.price) } catch (cause) { priceError = cause instanceof Error ? cause.message : 'Geçersiz fiyat' }
  const nameInvalid = invalid || !value.name.trim() || value.name.length > 100
  const changed = JSON.stringify(value) !== JSON.stringify(original)
  const cell = 'block min-w-0 whitespace-normal p-3 md:table-cell md:align-top'
  return <TableRow className="relative mb-3 grid grid-cols-2 rounded-xl border bg-card md:mb-0 md:table-row md:rounded-none md:border-x-0 md:border-t-0" data-state={changed ? 'selected' : undefined}>
    <TableCell className={cn(cell, "col-span-2 md:w-[22%]")}>
      <Field data-invalid={nameInvalid}><FieldLabel className="md:sr-only" htmlFor={`bulk-name-${id}`}>Ürün adı</FieldLabel>
        <Input id={`bulk-name-${id}`} value={value.name} maxLength={100} aria-invalid={nameInvalid} onChange={e => onChange(id, { name: e.target.value })} />
        {value.name !== original.name && <span className="text-xs text-muted-foreground">Önce: {original.name}</span>}
      </Field>
    </TableCell>
    <TableCell className={cn(cell, "col-span-2 md:w-[26%]")}><Field><FieldLabel className="md:sr-only" htmlFor={`bulk-description-${id}`}>Açıklama</FieldLabel>
      <Input id={`bulk-description-${id}`} value={value.description ?? ''} placeholder="Açıklama ekle" maxLength={500} onChange={e => onChange(id, { description: e.target.value || null })} /></Field></TableCell>
    <TableCell className={cn(cell, "md:w-32")}><Field data-invalid={Boolean(priceError)}><FieldLabel className="md:sr-only" htmlFor={`bulk-price-${id}`}>Fiyat (TL)</FieldLabel>
      <Input id={`bulk-price-${id}`} inputMode="decimal" aria-invalid={Boolean(priceError)} aria-describedby={priceError ? `bulk-price-error-${id}` : undefined} value={value.price} onChange={e => onChange(id, { price: e.target.value })} />
      {priceError ? <span id={`bulk-price-error-${id}`} role="alert" className="text-xs text-destructive">{priceError}</span> : value.price !== original.price && <span className="text-xs text-muted-foreground">Önce: {original.price} TL</span>}
    </Field></TableCell>
    <TableCell className={cn(cell, "md:w-[20%]")}><Field><FieldLabel className="md:sr-only" htmlFor={`bulk-category-${id}`}>Kategori</FieldLabel>
      <MenuBulkSelect id={`bulk-category-${id}`} value={value.category_id} onChange={category_id => onChange(id, { category_id })} options={categories.map(category => ({ value: category.id, label: [categories.find(c => c.id === category.parent_id)?.name, category.name].filter(Boolean).join(' / ') }))} />
    </Field></TableCell>
    <TableCell className={cn(cell, "md:w-32")}><Field><FieldLabel className="md:sr-only" htmlFor={`bulk-status-${id}`}>Yayın durumu</FieldLabel>
      <MenuBulkSelect id={`bulk-status-${id}`} value={String(value.is_available)} onChange={value => onChange(id, { is_available: value === 'true' })} options={[{ value: 'true', label: 'Yayında' }, { value: 'false', label: 'Pasif' }]} />
    </Field></TableCell>
    <TableCell className={cn(cell, "self-end md:w-10")}><Button variant="ghost" size="icon-sm" onClick={() => onRemove(id)} aria-label={`${value.name} ürününü seçimden çıkar`}><XIcon /></Button></TableCell>
  </TableRow>
})
