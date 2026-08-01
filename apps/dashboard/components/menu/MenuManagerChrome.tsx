'use client'

import { useEffect, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import PageTopBar from '../layout/PageTopBar'
import { I, btnGhost, btnPrimary } from '../../lib/ui'
import { deriveMenuManagerEmptyState } from './menu-manager-view-model'

export function MenuManagerTopBar({
  restaurantName,
  restaurantSlug,
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
  restaurantSlug: string
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
  const creationState = deriveMenuManagerEmptyState({ categoryCount, itemCount: 0 })
  const requiresCategory = creationState.action === 'add-category'

  return (
    <PageTopBar
      restaurantName={restaurantName}
      title="Menü"
      center={(
        <div style={{
          width: 'min(420px, 34vw)', minWidth: 300, display: 'flex', alignItems: 'center', gap: 8,
          height: 44, padding: '0 12px',
          background: 'var(--surface-3)', borderRadius: 8, color: 'var(--text-3)',
        }}>
          <I.search size={14} />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => onSearchFocusChange(false)}
            placeholder="Ürün veya kategori ara"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }}
          />
          {!search && !searchFocused && (
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
              {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
            </span>
          )}
        </div>
      )}
      right={(
        <>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onImportFileChange}
          />
          <button
            className="menu-top-action menu-top-action-secondary"
            style={btnGhost({ whiteSpace: 'nowrap' })}
            onClick={onOpenImport}
          >
            <I.upload size={13} />İçe aktar
          </button>
          <button
            className="menu-top-action menu-top-action-secondary"
            style={btnGhost({ whiteSpace: 'nowrap' })}
            onClick={() => window.open(
              `${process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'}/${restaurantSlug}`,
              '_blank',
            )}
          >
            <I.eye size={13} />Önizle
          </button>
          <button
            className="menu-top-action menu-top-action-primary"
            style={btnPrimary({ whiteSpace: 'nowrap' })}
            onClick={requiresCategory ? onOpenAddCategory : onOpenAddItem}
          >
            <I.plus size={13} />{requiresCategory ? 'Kategori ekle' : 'Yeni ürün'}
          </button>
        </>
      )}
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
    <div style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center', color: 'var(--text-3)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, background: 'var(--surface-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-2)', marginBottom: 14,
      }}><I.cutlery size={24} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{state.title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 220 }}>
        {state.description}
      </div>
      {state.action !== 'select-item' && (
        <button
          type="button"
          onClick={state.action === 'add-category' ? onAddCategory : onAddItem}
          style={btnPrimary({ marginTop: 16, justifyContent: 'center' })}
        >
          <I.plus size={13} />{state.action === 'add-category' ? 'Kategori ekle' : 'Yeni ürün'}
        </button>
      )}
    </div>
  )
}

/* ============================================================
   TOAST
   ============================================================ */
export function MenuManagerToast({ message, tone = 'error', onDone }: { message: string; tone?: 'error' | 'success'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: tone === 'success' ? 'var(--positive)' : 'var(--critical)', color: '#fff',
      padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: 'var(--shadow-pop)', zIndex: 200, pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

export function MenuManagerSkeleton() {
  const shimmer: CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-3) 0%, var(--surface-inset) 50%, var(--surface-3) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer-bg 1.4s ease-in-out infinite',
  }
  const skel = (style: CSSProperties) => <div style={{ borderRadius: 7, ...shimmer, ...style }} />
  return (
    <div className="menu-manager" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
      }}>
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
        <div style={{ width: 'var(--nav)', flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
            {skel({ width: 118, height: 16 })}
            {skel({ width: 148, height: 11, marginTop: 10 })}
          </div>
          <div style={{ flex: 1, padding: '18px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 39, width: '100%', borderRadius: 7, ...shimmer }} />
            ))}
            {skel({ height: 35, width: '100%', marginTop: 10, background: 'transparent', border: '1px dashed var(--border-strong)' })}
          </div>
          <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {skel({ width: '100%', height: 10 })}
            {skel({ width: '92%', height: 10 })}
            {skel({ width: '78%', height: 10 })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div style={{ height: 56, flexShrink: 0, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden' }}>
                  {skel({ width: '100%', height: 'auto', aspectRatio: '4 / 3', borderRadius: 0 })}
                  <div style={{ padding: '10px 12px 12px' }}>
                    {skel({ width: '64%', height: 14 })}
                    {skel({ width: '38%', height: 14, marginTop: 16 })}
                  </div>
                </div>
              ))}
              <div style={{ aspectRatio: '4 / 3', minHeight: 200, border: '1.5px dashed var(--border-strong)', borderRadius: 10 }} />
            </div>
          </div>
        </div>
        <div style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
          {skel({ width: 56, height: 56, borderRadius: 14 })}
          {skel({ width: 116, height: 14 })}
          {skel({ width: 194, height: 12 })}
        </div>
      </div>
    </div>
  )
}
