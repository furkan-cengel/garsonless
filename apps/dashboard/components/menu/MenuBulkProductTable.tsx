'use client'
import { useState } from 'react'
import { SearchIcon, ListFilterIcon } from 'lucide-react'
import type { Tables } from '@garsonless/db/types'
import type { MenuBulkItem } from '@garsonless/domain/menu-bulk'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MenuBulkFields } from './MenuBulkFields'
import { toBulkDraft, type BulkDraft } from './menu-bulk-editor-model'
export function MenuBulkProductTable({ original, draft, categories, conflicts, onChange, onRemove }: {
  original: MenuBulkItem[]; draft: BulkDraft[]; categories: Tables<'menu_categories'>[]; conflicts: string[]
  onChange: (id: string, patch: Partial<BulkDraft>) => void; onRemove: (id: string) => void
}) {
  const [search, setSearch] = useState(''), [visible, setVisible] = useState(50)
  const rows = original.map((item,index) => ({ item, value: draft[index]! })).filter(({ value }) => `${value.name} ${categories.find(category => category.id === value.category_id)?.name ?? ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))
  return <Card className="min-w-0 gap-0">
    <CardHeader className="gap-4 pb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle>Ürünler <Badge variant="secondary" className="ml-2">{original.length}</Badge></CardTitle><CardDescription>Hücreleri ayrı ayrı düzenleyebilir veya toplu işlem kuralını tüm seçime uygulayabilirsiniz.</CardDescription></div>
      <InputGroup className="w-full sm:w-64"><InputGroupAddon><SearchIcon /></InputGroupAddon><InputGroupInput aria-label="Seçili ürünlerde ara" placeholder="Ürün veya kategori ara…" value={search} onChange={e => { setSearch(e.target.value); setVisible(50) }} /></InputGroup>
    </div></CardHeader>
    <CardContent className="px-3 md:px-0">
      <Table className="block w-full md:table md:table-fixed"><TableHeader className="hidden bg-muted/50 md:table-header-group"><TableRow><TableHead className="w-[22%] px-3">Ürün adı</TableHead><TableHead className="w-[26%] px-3">Açıklama</TableHead><TableHead className="w-32 px-3">Fiyat · TL</TableHead><TableHead className="w-[20%] px-3">Kategori</TableHead><TableHead className="w-32 px-3">Durum</TableHead><TableHead className="w-10"><span className="sr-only">Seçim</span></TableHead></TableRow></TableHeader>
        <TableBody className="block md:table-row-group">{rows.slice(0,visible).map(({ item,value }) => <MenuBulkFields key={item.id} id={item.id} value={value} original={toBulkDraft(item)} categories={categories} invalid={conflicts.includes(item.id)} onChange={onChange} onRemove={onRemove} />)}</TableBody>
      </Table>
      {!rows.length && <Empty><EmptyHeader><EmptyMedia variant="icon"><ListFilterIcon /></EmptyMedia><EmptyTitle>Eşleşen ürün bulunamadı</EmptyTitle></EmptyHeader></Empty>}
      {visible < rows.length && <div className="flex justify-center p-4"><Button variant="outline" onClick={() => setVisible(current => current+50)}>Daha fazla ürün göster ({rows.length-visible})</Button></div>}
    </CardContent>
  </Card>
}
