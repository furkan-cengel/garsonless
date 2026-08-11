'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Tables } from '@garsonless/db/types'
import { replaceItemRecommendations } from '../../lib/actions/menu'
import { I } from '../../lib/ui'
import { haveSameOrderedIds } from './recommendation-editor-model'
import { useMenuSaveFeedback } from './use-menu-save-feedback'

export function MenuItemRecommendationEditor({
  restaurantId,
  sourceItem,
  allItems,
  initialIds,
  onSaved,
  onError,
  onDirtyChange,
}: {
  restaurantId: string
  sourceItem: Tables<'menu_items'>
  allItems: Tables<'menu_items'>[]
  initialIds: string[]
  onSaved: (ids: string[]) => void
  onError: (message: string) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [selectedIds, setSelectedIds] = useState(initialIds)
  const savedIdsRef = useRef(initialIds)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const byId = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems])
  const candidates = allItems
    .filter((item) => {
      if (item.id === sourceItem.id || selectedIds.includes(item.id) || item.deleted_at) return false
      const normalized = query.trim().toLocaleLowerCase('tr-TR')
      return !normalized || item.name.toLocaleLowerCase('tr-TR').includes(normalized)
    })
    .slice(0, 12)
  const isDirty = !haveSameOrderedIds(selectedIds, savedIdsRef.current)
  const { state: saveState, markSaved } = useMenuSaveFeedback({
    dirty: isDirty,
    saving: isPending,
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function changeSelection(update: (current: string[]) => string[]) {
    setSelectedIds(update)
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= selectedIds.length) return
    changeSelection((current) => {
      const next = [...current]
      const [entry] = next.splice(index, 1)
      if (entry) next.splice(target, 0, entry)
      return next
    })
  }

  function save() {
    if (saveState !== 'dirty') return
    const idsToSave = [...selectedIds]
    startTransition(async () => {
      try {
        const result = await replaceItemRecommendations({
          restaurantId,
          sourceItemId: sourceItem.id,
          recommendedItemIds: idsToSave,
        })
        if ('error' in result) return onError(result.error)
        savedIdsRef.current = idsToSave
        markSaved()
        onSaved(idsToSave)
      } catch (error) {
        console.error('[menu-item-recommendations-save-error]', error)
        onError('Öneriler kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.')
      }
    })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-3)' }}>Ürün detayında “Yanında iyi gider” başlığıyla gösterilir. En fazla 10 ürün seçebilirsin.</div>
      {selectedIds.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {selectedIds.map((id, index) => {
            const item = byId.get(id)
            if (!item) return null
            const image = Array.isArray(item.images) ? (item.images as string[])[0] : null
            return (
              <div
                key={id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: 7,
                  border: '1px solid var(--divider)',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 7,
                    overflow: 'hidden',
                    background: 'var(--surface-3)',
                  }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 10.5,
                      color: item.is_available ? 'var(--positive)' : 'var(--text-3)',
                    }}
                  >
                    {item.is_available ? 'Yayında' : 'Pasif · müşteriye gizli'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <Button type="button" variant="outline" size="icon-sm" aria-label={`${item.name} yukarı taşı`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <I.chevRight size={13} style={{ transform: 'rotate(-90deg)' }} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${item.name} aşağı taşı`}
                    disabled={index === selectedIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <I.chevRight size={13} style={{ transform: 'rotate(90deg)' }} />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    aria-label={`${item.name} önerisini kaldır`}
                    onClick={() => changeSelection((current) => current.filter((entry) => entry !== id))}
                  >
                    <I.close size={13} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {selectedIds.length < 10 && (
        <div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün ara ve ekle…"
            style={{
              width: '100%',
              height: 32,
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '0 10px',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          {query.trim() && (
            <div
              style={{
                marginTop: 5,
                maxHeight: 150,
                overflowY: 'auto',
                border: '1px solid var(--divider)',
                borderRadius: 8,
                background: 'var(--surface)',
              }}
            >
              {candidates.length === 0 ? (
                <div
                  style={{
                    padding: 10,
                    fontSize: 11.5,
                    color: 'var(--text-3)',
                  }}
                >
                  Eşleşen ürün yok.
                </div>
              ) : (
                candidates.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      changeSelection((current) => [...current, item.id])
                      setQuery('')
                    }}
                    style={{
                      width: '100%',
                      border: 0,
                      borderBottom: '1px solid var(--divider)',
                      background: 'transparent',
                      color: 'var(--text)',
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <strong>{item.name}</strong> <span style={{ color: 'var(--text-3)' }}>· ₺{Number(item.price).toLocaleString('tr-TR')}</span>
                  </Button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      <Button
        className="menu-save-action"
        type="button"
        disabled={saveState !== 'dirty'}
        data-save-state={saveState}
        onClick={save}
        variant={saveState === 'saved' ? 'positive' : saveState === 'clean' ? 'secondary' : 'default'}
      >
        <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saveState === 'saving' ? (
            <>
              <Spinner />
              Kaydediliyor…
            </>
          ) : saveState === 'saved' ? (
            <>
              <I.check size={14} />
              Kaydedildi
            </>
          ) : saveState === 'clean' ? (
            <>
              <I.check size={14} />
              Öneriler güncel
            </>
          ) : (
            'Önerileri kaydet'
          )}
        </span>
      </Button>
    </div>
  )
}
