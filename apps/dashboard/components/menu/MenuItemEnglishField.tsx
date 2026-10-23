'use client'

import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { MenuItemTranslation } from './use-menu-item-translation'

const STATUS_LABEL = { missing: 'Çevrilmedi', stale: 'Türkçe değişti', draft: 'Taslak', published: 'Yayında' } as const
const STATUS_VARIANT = { missing: 'secondary', stale: 'warning', draft: 'warning', published: 'positive' } as const

/**
 * English for a product's name or description, under its Turkish field.
 * "İngilizceye çevir" drafts every field of the product at once; Kaydet
 * publishes what is shown here.
 */
export function MenuItemEnglishField({ id, kind, translation, sourceDirty }: {
  id: string
  kind: 'name' | 'description'
  translation: MenuItemTranslation
  /** Unsaved Turkish edits: the translation would follow the old text, so translating waits for Kaydet. */
  sourceDirty: boolean
}) {
  const label = kind === 'name' ? 'İngilizce ad' : 'İngilizce açıklama'
  if (translation.state === 'locked') {
    return <FieldDescription className="text-[11px]">İngilizce menü çevirisi Pro, Pro denemesi ve Business paketlerinde kullanılabilir.</FieldDescription>
  }
  if (translation.state === 'unavailable') {
    return <FieldDescription className="text-[11px]">Çeviri şu anda yüklenemedi. Ürünü düzenlemeye devam edebilirsin.</FieldDescription>
  }
  const loading = translation.state === 'loading'
  const translating = translation.state === 'translating'
  if (!loading && !translation.hasField(kind)) {
    // Only published products with this text enter the translation list.
    if (kind === 'description') return null
    return <FieldDescription className="text-[11px]">Misafir menüsünde göründüğünde İngilizceye çevrilebilir.</FieldDescription>
  }
  const status = translation.status(kind)
  return (
    <Field className="gap-1.5 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FieldLabel htmlFor={id} className="text-xs font-medium">{label}</FieldLabel>
          {status && !translating && <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>}
        </div>
        <Button type="button" variant="outline" size="xs" disabled={loading || translating || sourceDirty} aria-busy={translating} onClick={() => void translation.translate()}
          title={sourceDirty ? 'Önce Türkçe değişiklikleri kaydet' : undefined}>
          {translating ? <Spinner aria-hidden="true" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          {translating ? 'Çevriliyor…' : 'İngilizceye çevir'}
        </Button>
      </div>
      {kind === 'name' ? (
        <Input id={id} value={translation.english('name')} disabled={loading || translating} maxLength={100} placeholder="English name" onChange={(event) => translation.setEnglish('name', event.target.value)} className="h-9 text-sm" />
      ) : (
        <Textarea id={id} value={translation.english('description')} disabled={loading || translating} maxLength={500} rows={3} placeholder="English description" onChange={(event) => translation.setEnglish('description', event.target.value)} className="min-h-20 resize-y text-[13px]" />
      )}
      <FieldDescription aria-live="polite" className="text-[11px]">
        {translation.error ?? (translating
          ? 'Çeviri hazırlanıyor; genelde bir dakika içinde hazır olur.'
          : sourceDirty
            ? 'Türkçe değişiklikleri kaydedince çevirebilirsin.'
            : translation.dirty
              ? 'Kontrol et, gerekirse düzelt; Kaydet ile yayınlanır.'
              : kind === 'name' && translation.otherFieldCount > 0
                ? `İçindekiler ve varyantlar dahil ${translation.otherFieldCount} alan daha birlikte çevrilir.`
                : !translation.enabled
                  ? 'İngilizce menü henüz kapalı; menünün tamamı çevrilince Çeviriler sayfasından açılır.'
                  : 'Misafirler İngilizce menüde bu metni görür.')}
      </FieldDescription>
    </Field>
  )
}
