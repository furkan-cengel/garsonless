'use client'

import { Redo2, RotateCcw, Undo2 } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { QRHealth, SaveState } from './tables-builder-types'

export function TablesQRPropertiesHeader({
  saveState,
  saveError,
  health,
  onRetry,
}: {
  saveState: SaveState
  saveError: string | null
  health: QRHealth
  onRetry: () => void
}) {
  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">QR stili</h2>
          <p className="text-xs text-muted-foreground">Tüm masalara uygulanır, kendiliğinden kaydedilir</p>
        </div>
      </div>
      {(saveState === 'blocked' || health.state === 'invalid') && (
        <Alert variant="destructive" aria-live="assertive" className="mt-3">
          <AlertTitle>Kaydetme engellendi</AlertTitle>
          <AlertDescription>{saveError ?? health.message}</AlertDescription>
        </Alert>
      )}
      {(saveState === 'error' || saveState === 'conflict') && (
        <Alert variant={saveState === 'error' ? 'destructive' : 'default'} role={saveState === 'error' ? 'alert' : 'status'} aria-live="polite" className="mt-3">
          <AlertTitle>{saveState === 'conflict' ? 'Stil güncellendi' : 'Değişiklikler kaydedilemedi'}</AlertTitle>
          <AlertDescription>{saveError ?? (saveState === 'conflict' ? 'Sunucudaki güncel QR stili yüklendi.' : 'Lütfen tekrar deneyin.')}</AlertDescription>
          {saveState === 'error' && <AlertAction><Button type="button" variant="outline" size="xs" onClick={onRetry}>Tekrar dene</Button></AlertAction>}
        </Alert>
      )}
    </div>
  )
}

export function TablesQRPropertiesFooter({ tableCount, onReset, onUndo, onRedo, canUndo, canRedo }: {
  tableCount: number
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 border-t bg-muted/30 p-3">
      <Button type="button" variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}><Undo2 data-icon="inline-start" />Geri al</Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onRedo} disabled={!canRedo} aria-label="İleri al" title="İleri al"><Redo2 /></Button>
      {/* The style is shared and auto-saved, so a reset reaches every printed table. */}
      <AlertDialog>
        <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" className="ml-auto border-[var(--critical)]/30 text-[var(--critical)]" />}><RotateCcw data-icon="inline-start" />Varsayılana dön</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>QR stili varsayılana dönsün mü?</AlertDialogTitle>
            <AlertDialogDescription>Renk, şekil, logo ve çerçeve {tableCount} masanın hepsinde varsayılana döner ve otomatik kaydedilir. Hemen ardından Geri al ile önceki stile dönebilirsin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onReset}>Varsayılana dön</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
