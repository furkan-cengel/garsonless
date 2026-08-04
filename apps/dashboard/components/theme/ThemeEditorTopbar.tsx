'use client'

import { I } from '../../lib/ui'

export type ThemePreviewMode = 'mobile' | 'desktop'

interface ThemeEditorTopbarProps {
  restaurantName: string
  previewMode: ThemePreviewMode
  showFullCopy: boolean
  saveStatusText: string
  saveStatusColor: string
  unsavedFieldLabels: string[]
  hasUnsavedChanges: boolean
  canUndo: boolean
  canRedo: boolean
  savingDraft: boolean
  publishing: boolean
  hasUnpublishedChanges: boolean
  publishBlockedReason?: string
  onPreviewModeChange: (mode: ThemePreviewMode) => void
  onUndo: () => void
  onRedo: () => void
  onOpenPreview: () => void
  onSave: () => void
  onPublish: () => void
}

export function ThemeEditorTopbar({
  restaurantName,
  previewMode,
  showFullCopy,
  saveStatusText,
  saveStatusColor,
  unsavedFieldLabels,
  hasUnsavedChanges,
  canUndo,
  canRedo,
  savingDraft,
  publishing,
  hasUnpublishedChanges,
  publishBlockedReason,
  onPreviewModeChange,
  onUndo,
  onRedo,
  onOpenPreview,
  onSave,
  onPublish,
}: ThemeEditorTopbarProps) {
  return (
    <div data-theme-editor-topbar style={{
      height: 52,
      minHeight: 52,
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: 16,
      padding: '6px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div data-theme-editor-context style={{ display: 'flex', alignItems: 'center', gap: showFullCopy ? 12 : 8, minWidth: 0 }}>
        {showFullCopy
          ? <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 18, width: 'auto', display: 'block', flexShrink: 0 }} />
          : <img src="/brand/masabu-m-favicon-transparent.svg" alt="Masabu" style={{ width: 26, height: 26, display: 'block', flexShrink: 0 }} />}
        {showFullCopy && <span style={{ color: 'var(--text-4)' }}>/</span>}
        <span style={{ color: 'var(--text-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {restaurantName}
        </span>
        {showFullCopy && <span style={{ color: 'var(--text-4)' }}>/</span>}
        <h1
          id="theme-editor-title"
          aria-label={`${restaurantName} Tema Düzenleyici`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Tema Düzenleyici
        </h1>
        <span aria-hidden="true" style={{ fontWeight: 650, fontSize: 13, color: 'var(--text)' }}>Tema Düzenleyici</span>
      </div>

      <div data-theme-editor-device-switch style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifySelf: 'center',
        background: 'var(--surface-3)',
        borderRadius: 9,
        padding: 3,
        gap: 2,
      }}>
        <SegmentButton
          active={previewMode === 'mobile'}
          icon={<I.phone size={17} />}
          label="Mobil"
          onClick={() => onPreviewModeChange('mobile')}
        />
        <SegmentButton
          active={previewMode === 'desktop'}
          icon={<I.monitor size={17} />}
          label="Masaüstü"
          onClick={() => onPreviewModeChange('desktop')}
        />
      </div>

      <div data-theme-editor-actions style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
        <span data-theme-editor-save-status role="status" aria-live="polite" aria-atomic="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-3)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: saveStatusColor }} />
          {saveStatusText}
        </span>
        <span
          data-theme-editor-change-count
          role="status"
          aria-live="polite"
          aria-atomic="true"
          title={hasUnsavedChanges
            ? unsavedFieldLabels.length > 0
              ? unsavedFieldLabels.join(', ')
              : 'Tema yapısı değişti'
            : undefined}
          style={{
            width: 104,
            height: 28,
            padding: '0 8px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: '#fff7ed',
            color: '#9a4d00',
            visibility: hasUnsavedChanges ? 'visible' : 'hidden',
            display: 'inline-flex',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11.5,
            fontWeight: 650,
            whiteSpace: 'nowrap',
          }}
        >
          {hasUnsavedChanges ? `${unsavedFieldLabels.length || 1} değişiklik` : ''}
        </span>
        <div style={{
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          borderRight: '1px solid var(--border)',
          paddingRight: 10,
          gap: 2,
        }}>
          <IconButton title="Geri al" disabled={!canUndo} onClick={onUndo}><I.undo size={17} /></IconButton>
          <IconButton title="Yinele" disabled={!canRedo} onClick={onRedo}><I.redo size={17} /></IconButton>
        </div>
        <button data-theme-editor-open-preview type="button" aria-label="Önizlemeyi yeni sekmede aç" onClick={onOpenPreview} style={topbarButtonStyle}>
          <I.eye size={17} />
          {showFullCopy && 'Önizle'}
        </button>
        <button
          data-theme-editor-save-draft
          type="button"
          onClick={onSave}
          disabled={!hasUnsavedChanges || savingDraft || publishing}
          title={!hasUnsavedChanges ? 'Kaydedilecek yeni değişiklik yok' : 'Değişiklikleri özel taslak olarak kaydet'}
          style={{
            ...topbarButtonStyle,
            cursor: savingDraft ? 'wait' : !hasUnsavedChanges || publishing ? 'not-allowed' : 'pointer',
          }}
        >
          {savingDraft ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          data-theme-editor-publish
          type="button"
          onClick={onPublish}
          disabled={hasUnsavedChanges || !hasUnpublishedChanges || savingDraft || publishing || Boolean(publishBlockedReason)}
          title={hasUnsavedChanges
            ? 'Önce değişiklikleri kaydet'
            : publishBlockedReason
              ? publishBlockedReason
            : !hasUnpublishedChanges
              ? 'Yayınlanacak kayıtlı taslak yok'
              : 'Kaydedilmiş taslağı canlı menüde yayınla'}
          style={{
            height: 34, padding: '0 18px', borderRadius: 8,
            border: 'none', background: 'var(--text)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: publishing ? 'wait' : hasUnsavedChanges || !hasUnpublishedChanges || savingDraft || publishBlockedReason ? 'not-allowed' : 'pointer',
          }}
        >
          {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
        </button>
      </div>
    </div>
  )
}

function SegmentButton({ active, icon, label, onClick }: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      minHeight: 30,
      border: 'none',
      borderRadius: 7,
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)',
      boxShadow: active ? 'var(--shadow-1)' : 'none',
      padding: '0 12px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 13,
      fontWeight: 650,
      cursor: 'pointer',
    }}>
      {icon}
      {label}
    </button>
  )
}

function IconButton({ children, title, disabled, onClick }: {
  children: React.ReactNode
  title: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--text-4)' : 'var(--text-2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

const topbarButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
}
