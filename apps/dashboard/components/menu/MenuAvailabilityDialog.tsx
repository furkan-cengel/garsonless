'use client'

import type { Tables } from '@garsonless/db/types'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export function MenuAvailabilityDialog({ item, onConfirm, onCancel }: {
  item: Pick<Tables<'menu_items'>, 'name' | 'is_available'>
  onConfirm: () => void
  onCancel: () => void
}) {
  return <AlertDialog open onOpenChange={(open) => { if (!open) onCancel() }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{item.name} {item.is_available ? 'pasife alınsın mı?' : 'yayımlansın mı?'}</AlertDialogTitle>
        <AlertDialogDescription>{item.is_available
          ? 'Ürün misafir menüsünde gizlenecek. Daha sonra yeniden yayına alabilirsiniz.'
          : 'Ürün mevcut fiyatı ve bilgileriyle misafir menüsünde görünecek.'}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>{item.is_available ? 'Pasife al' : 'Yayına al'}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
