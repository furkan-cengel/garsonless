'use client'

import dynamic from 'next/dynamic'
import type { Tables } from '@garsonless/db/types'
import type { useMenuCsvImport } from './use-menu-csv-import'

const NewProductDrawer = dynamic(() => import('./NewProductDrawer'))
const CsvImportStartModal = dynamic(() => import('./MenuCsvImportOverlays').then((module) => module.CsvImportStartModal))
const CsvImportModal = dynamic(() => import('./MenuCsvImportOverlays').then((module) => module.CsvImportModal))

export function MenuManagerOverlays({
  csvImport,
  showAddItem,
  activeCategoryId,
  categories,
  kitchenStations,
  restaurantId,
  loyaltyStampEnabled,
  onItemCreated,
  onCloseAddItem,
}: {
  csvImport: ReturnType<typeof useMenuCsvImport>
  showAddItem: boolean
  activeCategoryId: string | null
  categories: Tables<'menu_categories'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  restaurantId: string
  loyaltyStampEnabled: boolean
  onItemCreated: (item: Tables<'menu_items'>) => void
  onCloseAddItem: () => void
}) {
  const activeCategory = activeCategoryId
    ? categories.find((category) => category.id === activeCategoryId)
    : null

  return (
    <>
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
          categories={categories}
          kitchenStations={kitchenStations}
          loyaltyStampEnabled={loyaltyStampEnabled}
          onCreated={onItemCreated}
          onClose={onCloseAddItem}
        />
      )}
    </>
  )
}
