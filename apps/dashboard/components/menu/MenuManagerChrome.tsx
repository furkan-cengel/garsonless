'use client'

import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'

import { useEffect, useRef, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import PageTopBar from '../layout/PageTopBar'
import { I } from '../../lib/ui'
import { deriveMenuManagerEmptyState } from './menu-manager-view-model'

export function MenuManagerTopBar({
  restaurantName,
  publicMenuPath,
  search,
  searchFocused,
  searchInputRef,
  importFileInputRef,
  categoryCount,
  onSearchChange,
  onSearchFocusChange,
  onImportFileChange,
  onOpenImport,
  onOpenAddCategory,
  onOpenAddItem,
}: {
  restaurantName: string
  publicMenuPath: string
  search: string
  searchFocused: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
  importFileInputRef: RefObject<HTMLInputElement | null>
  categoryCount: number
  onSearchChange: (value: string) => void
  onSearchFocusChange: (focused: boolean) => void
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenImport: () => void
  onOpenAddCategory: () => void
  onOpenAddItem: () => void
}) {
  const creationState = deriveMenuManagerEmptyState({
    categoryCount,
    itemCount: 0,
  })
  const requiresCategory = creationState.action === 'add-category'

  return (
    <PageTopBar
      restaurantName={restaurantName}
      title="Menü"
      center={
        <InputGroup className="menu-search-control min-w-[300px] border-transparent bg-[var(--surface-3)] shadow-none" style={{ width: 'min(420px, 34vw)' }}>
          <InputGroupAddon>
            <I.search size={14} />
          </InputGroupAddon>
          <InputGroupInput
            className="menu-search-input"
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => onSearchFocusChange(false)}
            placeholder="Ürün veya kategori ara"
            style={{ fontSize: 12.5, color: 'var(--text)' }}
          />
          {!search && !searchFocused && (
            <InputGroupAddon align="inline-end">
              <kbd
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10.5,
                }}
              >
                {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
              </kbd>
            </InputGroupAddon>
          )}
        </InputGroup>
      }
      right={
        <>
          <Input ref={importFileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onImportFileChange} />
          <Button className="menu-top-action menu-top-action-secondary" variant="outline" size="sm" onClick={onOpenImport}>
            <I.upload data-icon="inline-start" size={13} />
            İçe aktar
          </Button>
          <Button
            className="menu-top-action menu-top-action-secondary"
            variant="outline"
            size="sm"
            onClick={() => window.open(`${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}${publicMenuPath}`, '_blank')}
          >
            <I.eye data-icon="inline-start" size={13} />
            Önizle
          </Button>
          <Button className="menu-top-action menu-top-action-primary" size="sm" onClick={requiresCategory ? onOpenAddCategory : onOpenAddItem}>
            <I.plus data-icon="inline-start" size={13} />
            {requiresCategory ? 'Kategori ekle' : 'Yeni ürün'}
          </Button>
        </>
      }
    />
  )
}

export function MenuManagerEmptyPanel({
  categoryCount,
  itemCount,
  onAddCategory,
  onAddItem,
}: {
  categoryCount: number
  itemCount: number
  onAddCategory: () => void
  onAddItem: () => void
}) {
  const state = deriveMenuManagerEmptyState({ categoryCount, itemCount })
  return (
    <Empty
      className="menu-manager-empty-panel rounded-none border-0"
      style={{
        width: 'var(--props)',
        flex: '0 0 var(--props)',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-14 rounded-xl">
          <I.cutlery size={24} />
        </EmptyMedia>
        <EmptyTitle>{state.title}</EmptyTitle>
        <EmptyDescription>{state.description}</EmptyDescription>
      </EmptyHeader>
      {state.action !== 'select-item' && (
        <EmptyContent>
          <Button type="button" size="sm" onClick={state.action === 'add-category' ? onAddCategory : onAddItem}>
            <I.plus data-icon="inline-start" size={13} />
            {state.action === 'add-category' ? 'Kategori ekle' : 'Yeni ürün'}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

/* ============================================================
   TOAST
   ============================================================ */
export function MenuManagerToast({ message, tone = 'error', onDone }: { message: string; tone?: 'error' | 'success'; onDone: () => void }) {
  const shownMessageRef = useRef<string | null>(null)
  useEffect(() => {
    if (shownMessageRef.current === message) return
    shownMessageRef.current = message
    toast.add({ title: message, type: tone, timeout: 4000 })
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [message, onDone, tone])
  return null
}

export function MenuManagerSkeleton() {
  const skel = (style: CSSProperties) => <Skeleton style={{ borderRadius: 7, ...style }} />
  return (
    <div
      className="menu-manager"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Menü yöneticisi yükleniyor"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      <div aria-hidden="true" style={{ display: 'contents' }}>
        <div
          style={{
            height: 52,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {skel({ width: 26, height: 26 })}
            {skel({ width: 86, height: 13 })}
            {skel({ width: 1, height: 28, borderRadius: 0 })}
            {skel({ width: 120, height: 24 })}
            {skel({ width: 44, height: 12 })}
          </div>
          {skel({ width: 420, maxWidth: '34vw', minWidth: 300, height: 32 })}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            {skel({ width: 84, height: 30 })}
            {skel({ width: 78, height: 30 })}
            {skel({ width: 92, height: 30 })}
            {skel({ width: 30, height: 30 })}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div
            style={{
              width: 'var(--nav)',
              flexShrink: 0,
              borderRight: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              {skel({ width: 118, height: 16 })}
              {skel({ width: 148, height: 11, marginTop: 10 })}
            </div>
            <div
              style={{
                flex: 1,
                padding: '18px 8px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 39, width: '100%', borderRadius: 7 }} />
              ))}
              {skel({
                height: 35,
                width: '100%',
                marginTop: 10,
                background: 'transparent',
                border: '1px dashed var(--border-strong)',
              })}
            </div>
            <div
              style={{
                borderTop: '1px solid var(--divider)',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {skel({ width: '100%', height: 10 })}
              {skel({ width: '92%', height: 10 })}
              {skel({ width: '78%', height: 10 })}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg)',
            }}
          >
            <div
              style={{
                height: 56,
                flexShrink: 0,
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div>
                {skel({ width: 106, height: 18 })}
                {skel({ width: 132, height: 11, marginTop: 8 })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {skel({ width: 72, height: 30 })}
                {skel({ width: 72, height: 30 })}
                {skel({ width: 58, height: 30 })}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: 24 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {skel({
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '4 / 3',
                      borderRadius: 0,
                    })}
                    <div style={{ padding: '10px 12px 12px' }}>
                      {skel({ width: '64%', height: 14 })}
                      {skel({ width: '38%', height: 14, marginTop: 16 })}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    minHeight: 200,
                    border: '1.5px dashed var(--border-strong)',
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              width: 'var(--props)',
              flexShrink: 0,
              borderLeft: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {skel({ width: 56, height: 56, borderRadius: 14 })}
            {skel({ width: 116, height: 14 })}
            {skel({ width: 194, height: 12 })}
          </div>
        </div>
      </div>
    </div>
  )
}
