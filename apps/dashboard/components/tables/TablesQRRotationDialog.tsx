'use client'

import { RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { TableItem } from './tables-builder-types'

export function TablesQRRotationDialog({
  table,
  rotating,
  error,
  onCancel,
  onConfirm,
}: {
  table: TableItem | null
  rotating: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!table) return null

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !rotating) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-[var(--warning-bg)] text-[var(--warning)]">
            <RefreshCw className={rotating ? 'animate-spin' : undefined} />
          </AlertDialogMedia>
          <AlertDialogTitle>{table.label} için yeni QR oluşturulsun mu?</AlertDialogTitle>
          <AlertDialogDescription>
            Mevcut QR bağlantısı hemen iptal edilir. Masadaki eski baskılar artık menüyü açmaz; yeni QR’ı yeniden indirip kullanmanız gerekir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rotating}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" onClick={onConfirm} disabled={rotating}>
            {rotating ? 'Oluşturuluyor…' : 'Eski QR’ı iptal et'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
