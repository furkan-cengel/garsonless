'use client'

import { useRef } from 'react'
import { I } from '../../lib/ui'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogMedia } from '@/components/ui/alert-dialog'

interface Props {
  title?: string
  description: string
  discardLabel?: string
  keepLabel?: string
  onKeepEditing: () => void
  onDiscard: () => void
}

export default function UnsavedChangesDialog({
  title = 'Kaydedilmemiş değişiklikler var',
  description,
  discardLabel = 'Değişiklikleri sil',
  keepLabel = 'Düzenlemeye dön',
  onKeepEditing,
  onDiscard,
}: Props) {
  const keepRef = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onKeepEditing() }}>
      <AlertDialogContent initialFocus={keepRef}>
        <AlertDialogHeader>
          <AlertDialogMedia><I.undo /></AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef}>{keepLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>{discardLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
