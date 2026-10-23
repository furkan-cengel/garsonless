'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useEffect, useRef, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import PageTopBar from '../layout/PageTopBar'
import { MenuWorkspaceSkeleton } from './MenuWorkspaceSkeleton'
import { I } from '../../lib/ui'
import { deriveMenuManagerEmptyState } from './menu-manager-view-model'
import type { MenuWorkspaceStage } from './menu-manager-view-model'
import type { MenuLiveStatus } from './use-menu-live-state'

export function MenuLiveNotice({
  status,
  updatePending,
  onRetry,
}: {
  status: MenuLiveStatus
  updatePending: boolean
  onRetry: () => void
}) {
  if (status === 'live' && !updatePending) return null
  return (
    <div
      className="menu-live-notice"
      role="status"
      aria-live="polite"
      style={{
        minHeight: 34,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '5px 14px',
        borderBottom: '1px solid var(--divider)',
        background: updatePending ? 'var(--warning-bg)' : 'var(--surface-2)',
        color: 'var(--text-2)',
        fontSize: 12,
      }}
    >
      <span>
        {updatePending
          ? 'Başka bir oturumda güncelleme var. Açık taslağın korunuyor.'
          : status === 'offline'
            ? 'Canlı bağlantı kesildi. Son yüklenen menü gösteriliyor.'
            : 'Canlı bağlantı kuruluyor…'}
      </span>
      {status === 'offline' && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Yeniden bağlan
        </Button>
      )}
    </div>
  )
}

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
  workspaceStage,
  mobileContext,
  onMobileBack,
  onClearSearch,
  onBulkAll,
  onBulkHistory,
  itemCount,
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
  workspaceStage: MenuWorkspaceStage
  mobileContext: string
  onMobileBack: () => void
  onClearSearch: () => void
  onBulkAll: () => void
  onBulkHistory: () => void
  itemCount: number
}) {
  const creationState = deriveMenuManagerEmptyState({
    categoryCount,
    itemCount: 0,
  })
  const requiresCategory = creationState.action === 'add-category'

  return (
    <PageTopBar
      className="menu-manager-topbar"
      restaurantName={restaurantName}
      title="Menü"
      tag={<span className="menu-mobile-context">{mobileContext}</span>}
      onBack={workspaceStage === 'editor' ? onMobileBack : undefined}
      backLabel={workspaceStage === 'editor' ? 'Ürünlere dön' : 'Kategorilere dön'}
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
            aria-label="Ürün veya kategori ara"
            style={{ fontSize: 12.5, color: 'var(--text)' }}
          />
          {search && <InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label="Aramayı temizle" onClick={onClearSearch}><I.close /></Button></InputGroupAddon>}
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
          <Button aria-label="İçe aktar" className="menu-top-action menu-top-action-secondary" variant="outline" size="sm" onClick={onOpenImport}>
            <I.upload data-icon="inline-start" size={13} />
            <span className="menu-top-action-label">İçe aktar</span>
          </Button>
          <Button
            className="menu-top-action menu-top-action-secondary"
            aria-label="Menüyü önizle"
            variant="outline"
            size="sm"
            onClick={() => window.open(`${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}${publicMenuPath}`, '_blank')}
          >
            <I.eye data-icon="inline-start" size={13} />
            <span className="menu-top-action-label">Önizle</span>
          </Button>
          <Button className="menu-top-action menu-top-action-primary" size="sm" onClick={requiresCategory ? onOpenAddCategory : onOpenAddItem}>
            <I.plus data-icon="inline-start" />
            {requiresCategory ? 'Kategori ekle' : 'Yeni ürün'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Menü işlemleri"
              className="menu-overflow-actions"
              render={<Button type="button" variant="outline" size="icon-sm" />}
            >
              <I.more />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
              <DropdownMenuItem disabled={!itemCount} onClick={onBulkAll}><I.clipboard />Tüm ürünleri düzenle ({itemCount})</DropdownMenuItem>
              <DropdownMenuItem onClick={onBulkHistory}><I.history />Toplu işlem geçmişi</DropdownMenuItem>
              {/* On phones the top bar only keeps + Yeni ürün; these move into the menu. */}
              <DropdownMenuItem className="menu-overflow-mobile-item" onClick={onOpenImport}>
                <I.upload />
                İçe aktar
              </DropdownMenuItem>
              <DropdownMenuItem className="menu-overflow-mobile-item" onClick={() => window.open(`${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}${publicMenuPath}`, '_blank')}>
                <I.eye />
                Önizle
              </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
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
          className="menu-manager-skeleton-topbar"
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
        <MenuWorkspaceSkeleton />
      </div>
    </div>
  )
}
