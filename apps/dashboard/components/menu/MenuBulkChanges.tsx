'use client'
import type { Tables } from '@garsonless/db/types'
import { MENU_BULK_FIELDS, type MenuBulkChange } from '@garsonless/domain/menu-bulk'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
const labels = { name: 'Ürün adı', description: 'Açıklama', price: 'Fiyat', category_id: 'Kategori', is_available: 'Yayın durumu' }
export function MenuBulkChanges({ changes, categories }: { changes: MenuBulkChange[]; categories: Tables<'menu_categories'>[] }) {
  function format(field: keyof typeof labels, value: unknown) {
    if (field === 'price') return `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
    if (field === 'category_id') return categories.find(c => c.id === value)?.name ?? 'Silinmiş kategori'
    if (field === 'is_available') return value ? 'Yayında' : 'Pasif'
    return String(value ?? '') || '—'
  }
  return <Table><TableHeader><TableRow><TableHead>Ürün / alan</TableHead><TableHead>Önce</TableHead><TableHead>Sonra</TableHead></TableRow></TableHeader>
    <TableBody>{changes.flatMap(change => MENU_BULK_FIELDS.filter(field => field in change.after).map(field => <TableRow key={`${change.id}-${field}`}>
      <TableCell className="max-w-48 whitespace-normal break-words">{change.name}<br /><span className="text-muted-foreground">{labels[field]}</span></TableCell>
      <TableCell className="max-w-80 whitespace-pre-wrap break-words">{format(field, change.before[field])}</TableCell><TableCell className="max-w-80 whitespace-pre-wrap break-words">{format(field, change.after[field])}</TableCell>
    </TableRow>))}</TableBody></Table>
}
