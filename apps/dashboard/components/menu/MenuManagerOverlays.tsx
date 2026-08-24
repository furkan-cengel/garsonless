'use client'

import dynamic from 'next/dynamic'
import type { Tables } from '@garsonless/db/types'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import type { useMenuCsvImport } from './use-menu-csv-import'

const NewProductDrawer = dynamic(() => import('./NewProductDrawer'))
const CsvImportStartModal = dynamic(() => import('./MenuCsvImportOverlays').then((module) => module.CsvImportStartModal))
const CsvImportModal = dynamic(() => import('./MenuCsvImportOverlays').then((module) => module.CsvImportModal))

export function MenuManagerOverlays({
  pendingEditorExit,
  onKeepEditing,
  onDiscardChanges,
  csvImport,
  showAddItem,
  activeCategoryId,
  categories,
  kitchenStations,
  restaurantId,
  onItemCreated,
  onCloseAddItem,
}: {
  pendingEditorExit: (() => void) | null
  onKeepEditing: () => void
  onDiscardChanges: () => void
  csvImport: ReturnType<typeof useMenuCsvImport>
  showAddItem: boolean
  activeCategoryId: string | null
  categories: Tables<'menu_categories'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  restaurantId: string
  onItemCreated: (item: Tables<'menu_items'>) => void
  onCloseAddItem: () => void
}) {
  const activeCategory = activeCategoryId
    ? categories.find((category) => category.id === activeCategoryId)
    : null

  return (
    <>
      {pendingEditorExit && (
        <UnsavedChangesDialog
          description="Bu üründe yaptığın değişiklikler henüz kaydedilmedi. Çıkarsan değişiklikler kalıcı olarak silinecek."
          onKeepEditing={onKeepEditing}
          onDiscard={onDiscardChanges}
        />
      )}
      {csvImport.showStart && (
        <CsvImportStartModal
          error={csvImport.setupError}
          onChoose={csvImport.chooseFile}
          onFile={csvImport.parseFile}
          onCancel={csvImport.closeStart}
          onDownloadTemplate={csvImport.downloadTemplate}
        />
      )}
      {csvImport.preview && (
        <CsvImportModal
          preview={csvImport.preview}
          onConfirm={csvImport.importPreview}
          onCancel={csvImport.cancelPreview}
          onDownloadTemplate={csvImport.downloadTemplate}
        />
      )}
      {showAddItem && activeCategory && (
        <NewProductDrawer
          restaurantId={restaurantId}
          categoryId={activeCategory.id}
          categoryName={activeCategory.name}
          categoryStationId={activeCategory.kitchen_station_id}
          kitchenStations={kitchenStations}
          onCreated={onItemCreated}
          onClose={onCloseAddItem}
        />
      )}
    </>
  )
}
