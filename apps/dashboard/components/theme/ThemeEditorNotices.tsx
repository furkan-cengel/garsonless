'use client'

import { Button } from '@/components/ui/button'
import { ThemeDraftRecoveryPanel } from './ThemeDraftRecoveryPanel'
import type { useThemeDraftRecovery } from './use-theme-draft-recovery'

interface Props {
  restaurantName: string
  saveStatusText: string
  hasUnsavedChanges: boolean
  unsavedFieldLabels: string[]
  contrastWarningReason?: string
  onInspectContrast: () => void
  recovery: ReturnType<typeof useThemeDraftRecovery>
  recoveryBlocked: boolean
}

export function ThemeEditorNotices({ restaurantName, saveStatusText, hasUnsavedChanges, unsavedFieldLabels,
  contrastWarningReason, onInspectContrast, recovery, recoveryBlocked }: Props) {
  return <>
    <div data-theme-editor-persistent-status className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background px-3 py-2 text-xs">
      <span className="min-w-0 break-words font-medium">{restaurantName}</span>
      <span role="status" aria-live="polite" aria-atomic="true">
        {saveStatusText}{hasUnsavedChanges ? ` · ${unsavedFieldLabels.length || 1} değişiklik` : ''}
      </span>
      {contrastWarningReason && <Button variant="link" size="sm" className="h-auto min-w-0 max-w-full shrink whitespace-normal p-0 text-left text-xs" disabled={recoveryBlocked} onClick={onInspectContrast}>Kontrast önerisi: {contrastWarningReason} · İncele</Button>}
    </div>
    <ThemeDraftRecoveryPanel recovery={recovery} />
  </>
}
