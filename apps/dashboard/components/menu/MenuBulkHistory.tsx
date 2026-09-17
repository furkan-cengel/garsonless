'use client'
import { ArrowLeftIcon, ArrowUpRightIcon, HistoryIcon, RefreshCwIcon, Undo2Icon } from 'lucide-react'
import type { Tables } from '@garsonless/db/types'
import type { MenuBulkChange, MenuBulkOperation } from '@garsonless/domain/menu-bulk'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MenuBulkActor } from './MenuBulkActor'
import { MenuBulkChanges } from './MenuBulkChanges'
export function MenuBulkHistory({ history, detail, categories, pending, error, offset, onPage, onDetail, onBack, onUndo }: {
  history: MenuBulkOperation[]; detail: { operation: MenuBulkOperation; changes: MenuBulkChange[] } | null
  categories: Tables<'menu_categories'>[]; pending: boolean; error: string; offset: number
  onPage: (offset: number) => void; onDetail: (operation: MenuBulkOperation) => void; onBack: () => void; onUndo: () => void
}) {
  if (detail) return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-col gap-4"><Button variant="ghost" size="sm" className="self-start" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" />Geçmişe dön</Button><CardTitle>İşlem ayrıntıları</CardTitle><MenuBulkActor operation={detail.operation} /></div>
    <div className="flex flex-col items-end gap-3"><CardDescription>{new Date(detail.operation.created_at).toLocaleString('tr-TR')}</CardDescription>{!detail.operation.undo_of && !detail.operation.undone_by && <Button variant="outline" onClick={onUndo}><Undo2Icon data-icon="inline-start" />Bu işlemi geri al</Button>}</div></div></CardHeader><CardContent><MenuBulkChanges changes={detail.changes} categories={categories} /></CardContent></Card>
  return <Card><CardHeader><div className="flex items-start justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle>İşlem geçmişi</CardTitle><CardDescription>Kim, ne zaman ve hangi ürünleri değiştirdi?</CardDescription></div><Button variant="outline" size="sm" onClick={() => onPage(offset)} disabled={pending}><RefreshCwIcon data-icon="inline-start" />{pending ? 'Yükleniyor…' : 'Yenile'}</Button></div></CardHeader>
    <CardContent className="flex flex-col gap-4">
      {!pending && !error && !history.length ? <Empty><EmptyHeader><EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia><EmptyTitle>Henüz işlem yok</EmptyTitle><EmptyDescription>Yayımladığınız toplu düzenlemeler burada görünür.</EmptyDescription></EmptyHeader></Empty> : <Table><TableHeader><TableRow><TableHead>İşlemi yapan</TableHead><TableHead>Değişiklik</TableHead><TableHead>Tarih</TableHead><TableHead><span className="sr-only">Ayrıntılar</span></TableHead></TableRow></TableHeader>
        <TableBody>{history.map(operation => <TableRow key={operation.id}><TableCell><MenuBulkActor operation={operation} /></TableCell><TableCell><div className="flex flex-col items-start gap-2"><span>{operation.count} ürün {operation.undo_of ? 'geri yüklendi' : 'güncellendi'}</span>{operation.undone_by && <Badge variant="secondary">Geri alındı</Badge>}</div></TableCell><TableCell className="text-muted-foreground">{new Date(operation.created_at).toLocaleDateString('tr-TR')}<br />{new Date(operation.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => onDetail(operation)}>Ayrıntılar<ArrowUpRightIcon data-icon="inline-end" /></Button></TableCell></TableRow>)}</TableBody></Table>}
      <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={pending || offset === 0} onClick={() => onPage(offset-20)}>Önceki</Button><Button variant="outline" size="sm" disabled={pending || history.length<20} onClick={() => onPage(offset+20)}>Sonraki</Button></div>
    </CardContent>
  </Card>
}
