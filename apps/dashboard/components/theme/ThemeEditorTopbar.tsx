'use client'

import Image from 'next/image'
import { I } from '../../lib/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
      gridTemplateColumns: 'minmax(0, 0.8fr) auto minmax(0, 1.2fr)',
      alignItems: 'center',
      gap: 16,
      padding: '6px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div data-theme-editor-context style={{ display: 'flex', alignItems: 'center', gap: showFullCopy ? 12 : 8, minWidth: 0 }}>
        {showFullCopy
          ? <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={83} height={18} priority style={{ height: 18, width: 'auto', display: 'block', flexShrink: 0 }} />
          : <Image src="/brand/masabu-m-favicon-transparent.svg" alt="Masabu" width={26} height={26} priority style={{ width: 26, height: 26, display: 'block', flexShrink: 0 }} />}
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

      <ToggleGroup
        data-theme-editor-device-switch
        value={[previewMode]}
        onValueChange={(values) => { const next = values[0] as ThemePreviewMode | undefined; if (next) onPreviewModeChange(next) }}
        size="sm"
        spacing={1}
        className="justify-self-center whitespace-nowrap bg-muted p-1"
        aria-label="Önizleme cihazı"
      >
        <ToggleGroupItem value="mobile"><I.phone data-icon="inline-start" />Mobil</ToggleGroupItem>
        <ToggleGroupItem value="desktop"><I.monitor data-icon="inline-start" />Masaüstü</ToggleGroupItem>
      </ToggleGroup>

      <div data-theme-editor-actions style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
        <Badge data-theme-editor-save-status variant="outline" role="status" aria-live="polite" aria-atomic="true" className="shrink-0">
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: saveStatusColor }} />
          {saveStatusText}
        </Badge>
        <Badge
          data-theme-editor-change-count
          variant="warning"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          title={hasUnsavedChanges
            ? unsavedFieldLabels.length > 0
              ? unsavedFieldLabels.join(', ')
              : 'Tema yapısı değişti'
            : undefined}
          className={hasUnsavedChanges ? 'w-[104px]' : 'invisible w-[104px]'}
        >
          {hasUnsavedChanges ? `${unsavedFieldLabels.length || 1} değişiklik` : ''}
        </Badge>
        <div className="inline-flex h-8 items-center gap-1">
          <ButtonGroup aria-label="Düzenleme geçmişi">
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Geri al" disabled={!canUndo} onClick={onUndo}><I.undo /></Button>
              </TooltipTrigger>
              <TooltipContent>Geri al</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Yinele" disabled={!canRedo} onClick={onRedo}><I.redo /></Button>
              </TooltipTrigger>
              <TooltipContent>Yinele</TooltipContent>
            </Tooltip>
          </ButtonGroup>
          <Separator orientation="vertical" className="ml-1 h-5" />
        </div>
        <Button data-theme-editor-open-preview type="button" variant="outline" aria-label="Önizlemeyi yeni sekmede aç" onClick={onOpenPreview}>
          <I.eye data-icon="inline-start" />
          {showFullCopy && 'Önizle'}
        </Button>
        <Button
          data-theme-editor-save-draft
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={!hasUnsavedChanges || savingDraft || publishing}
          title={!hasUnsavedChanges ? 'Kaydedilecek yeni değişiklik yok' : 'Özel taslağa kaydet; masa QR menüsü henüz değişmez'}
        >
          {savingDraft && <Spinner data-icon="inline-start" />}
          {savingDraft ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        <Button
          data-theme-editor-publish
          type="button"
          onClick={onPublish}
          disabled={hasUnsavedChanges || !hasUnpublishedChanges || savingDraft || publishing}
          title={hasUnsavedChanges
            ? 'Önce değişiklikleri kaydet'
            : publishBlockedReason
              ? `${publishBlockedReason}; ayrıntıyı aç`
            : !hasUnpublishedChanges
              ? 'Yayınlanacak kayıtlı taslak yok'
              : 'Kaydedilmiş taslağı masa QR menüsünde yayınla'}
        >
          {publishing && <Spinner data-icon="inline-start" />}
          {!publishing && publishBlockedReason && <I.warn data-icon="inline-start" />}
          {publishing
            ? 'Yayınlanıyor…'
            : publishBlockedReason
              ? showFullCopy ? 'Yayın engelini düzelt' : 'Düzelt'
              : showFullCopy ? 'QR menüde yayınla' : 'Yayınla'}
        </Button>
      </div>
    </div>
  )
}
