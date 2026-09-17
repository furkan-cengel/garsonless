'use client'
import { useEffect, useState } from 'react'
import { ChevronDownIcon, SlidersHorizontalIcon, WandSparklesIcon } from 'lucide-react'
import type { Tables } from '@garsonless/db/types'
import type { MenuBulkRule } from '@garsonless/domain/menu-bulk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { MenuBulkSelect } from './MenuBulkSelect'
const option = ([value, label]: string[]) => ({ value: value!, label: label! })
export function MenuBulkRules({ categories, count, onApply }: { categories: Tables<'menu_categories'>[]; count: number; onApply: (rule: MenuBulkRule) => boolean }) {
  const [field, setField] = useState<MenuBulkRule['field']>('price')
  const [mode, setMode] = useState('percent-up'), [value, setValue] = useState(''), [find, setFind] = useState('')
  const [rounding, setRounding] = useState<1 | 100 | 500 | 1000>(1)
  const [expanded, setExpanded] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const expandOnDesktop = () => { if (media.matches) setExpanded(true) }
    media.addEventListener('change', expandOnDesktop)
    return () => media.removeEventListener('change', expandOnDesktop)
  }, [])
  const modes = field === 'price' ? [['percent-up','Yüzde artır'],['percent-down','Yüzde azalt'],['add','TL ekle'],['subtract','TL çıkar'],['set','Sabit fiyat']]
    : [['replace','Bul / değiştir'], ...(field === 'name' ? [['prefix','Başına ekle'],['suffix','Sonuna ekle']] : [['set','Ortak açıklama'],['clear','Açıklamayı temizle']])]
  return <Card className="gap-0"><Collapsible open={expanded} onOpenChange={setExpanded}>
    <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2"><SlidersHorizontalIcon className="size-4" />Toplu işlem</CardTitle>
      <CardDescription>Bir kuralı {count} ürünün tamamına uygula.</CardDescription>
      <CollapsibleTrigger render={<Button variant="outline" size="sm" className="mt-2 lg:hidden" />} aria-label="Toplu işlem ayarları">{expanded ? 'Ayarları gizle' : 'Kural oluştur'}<ChevronDownIcon data-icon="inline-end" /></CollapsibleTrigger>
    </CardHeader>
    <CollapsibleContent><CardContent className="pb-5"><FieldGroup className="gap-5">
      <Field><FieldLabel htmlFor="bulk-rule-field">Düzenlenecek alan</FieldLabel><MenuBulkSelect id="bulk-rule-field" value={field} options={[["price","Fiyat"],["name","Ürün adı"],["description","Açıklama"],["category_id","Kategori"],["is_available","Yayın durumu"]].map(option)} onChange={nextValue => {
        const next = nextValue as typeof field; setField(next); setMode(next === 'price' ? 'percent-up' : 'replace'); setValue(next === 'category_id' ? categories[0]?.id ?? '' : next === 'is_available' ? 'true' : '')
      }} /></Field>
      {(field === 'price' || field === 'name' || field === 'description') && <Field><FieldLabel htmlFor="bulk-rule-mode">İşlem</FieldLabel><MenuBulkSelect id="bulk-rule-mode" value={mode} onChange={setMode} options={modes.map(option)} /></Field>}
      {(field === 'name' || field === 'description') && mode === 'replace' && <Field><FieldLabel htmlFor="bulk-rule-find">Aranan metin</FieldLabel><Input id="bulk-rule-find" value={find} onChange={e => setFind(e.target.value)} /><FieldDescription>Büyük-küçük harfe duyarlıdır.</FieldDescription></Field>}
      {field === 'category_id' ? <Field><FieldLabel htmlFor="bulk-rule-value">Hedef kategori</FieldLabel><MenuBulkSelect id="bulk-rule-value" value={value} onChange={setValue} options={categories.map(c => ({ value: c.id, label: [categories.find(p => p.id === c.parent_id)?.name,c.name].filter(Boolean).join(' / ') }))} /></Field>
        : field === 'is_available' ? <Field><FieldLabel htmlFor="bulk-rule-value">Durum</FieldLabel><MenuBulkSelect id="bulk-rule-value" value={value} onChange={setValue} options={[["true","Yayına al"],["false","Pasife al"]].map(option)} /></Field>
        : mode !== 'clear' && <Field><FieldLabel htmlFor="bulk-rule-value">{field === 'price' ? 'Tutar / oran' : 'Yeni metin'}</FieldLabel><Input id="bulk-rule-value" placeholder={field === 'price' ? 'Örn. 10' : 'Metin girin'} inputMode={field === 'price' ? 'decimal' : 'text'} value={value} onChange={e => setValue(e.target.value)} /></Field>}
      {field === 'price' && <Field><FieldLabel htmlFor="bulk-rounding">Yuvarlama</FieldLabel><MenuBulkSelect id="bulk-rounding" value={String(rounding)} onChange={value => setRounding(Number(value) as typeof rounding)} options={[["1","Kuruş (0,01 TL)"],["100","En yakın 1 TL"],["500","En yakın 5 TL"],["1000","En yakın 10 TL"]].map(option)} /><FieldDescription>Yalnız ürünün ana fiyatı değişir.</FieldDescription></Field>}
    </FieldGroup></CardContent>
    <CardFooter className="flex flex-col items-stretch gap-3"><Button disabled={!count} onClick={() => {
      const applied = onApply((field === 'is_available' ? { field, value: value === 'true' } : { field, mode, value, find, rounding }) as MenuBulkRule)
      if (applied && !window.matchMedia('(min-width: 1024px)').matches) setExpanded(false)
    }}><WandSparklesIcon data-icon="inline-start" />{count} ürüne uygula</Button><p className="text-xs text-muted-foreground">Önce taslak güncellenir. Yayımlamadan önce değişiklikleri inceleyebilirsiniz.</p></CardFooter>
    </CollapsibleContent>
  </Collapsible></Card>
}
