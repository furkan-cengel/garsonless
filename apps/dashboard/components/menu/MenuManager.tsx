'use client'

import type { Tables } from '@garsonless/db/types'
import NewProductDrawer from './NewProductDrawer'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { useRouter } from 'next/navigation'
import { CsvImportModal, CsvImportStartModal } from './MenuCsvImportOverlays'
import { useMenuCsvImport } from './use-menu-csv-import'
import { deriveMenuManagerView } from './menu-manager-view-model'
import { MenuCategoryWorkspace } from './MenuCategoryWorkspace'
import { MenuItemEditPanel } from './MenuItemEditPanel'
import { MenuItemsWorkspace } from './MenuItemsWorkspace'
import {
  MenuManagerEmptyPanel,
  MenuManagerSkeleton,
  MenuManagerToast,
  MenuManagerTopBar,
} from './MenuManagerChrome'
import { useMenuManagerCommands } from './use-menu-manager-commands'
import { useMenuManagerShellState } from './use-menu-manager-shell-state'

interface Props {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  initialCategories: Tables<'menu_categories'>[]
  initialItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
}


export default function MenuManager({ restaurantId, restaurantName, restaurantSlug, initialCategories, initialItems, kitchenStations }: Props) {
  const router = useRouter()
  const shell = useMenuManagerShellState({ initialCategories, initialItems })
  const {
    mounted,
    categories,
    setCategories,
    items,
    setItems,
    activeCategory,
    setActiveCategory,
    activeSubCategory: activeSubCat,
    setActiveSubCategory: setActiveSubCat,
    selectedItem,
    setSelectedItem,
    setItemEditDirty,
    pendingEditorExit,
    showAddItem,
    setShowAddItem,
    search,
    setSearch,
    searchFocused,
    setSearchFocused,
    searchInputRef,
    toastMessage: toastMsg,
    toastTone,
    clearToast,
    showError,
    showSuccess,
    notify,
    selectItem,
    selectCategory: handleSelectCategory,
    selectSubCategory,
    addCategory,
    updateCategory,
    saveItem,
    removeItem,
    createItem,
    closeItemEditor,
    keepEditing,
    discardPendingChanges,
  } = shell
  const commands = useMenuManagerCommands({
    restaurantId,
    categories,
    setCategories,
    items,
    setItems,
    activeCategory,
    setActiveCategory,
    setActiveSubCategory: setActiveSubCat,
    selectedItem,
    setSelectedItem,
    onError: showError,
    onSuccess: showSuccess,
  })
  const csvImport = useMenuCsvImport({
    restaurantId,
    categories,
    items,
    onCategoriesCreated: (createdCategories) => {
      setCategories((current) => [...current, ...createdCategories])
    },
    onComplete: (message, tone) => {
      notify(message, tone)
    },
    onRefresh: () => router.refresh(),
  })

  if (!mounted) return <MenuManagerSkeleton />

  const {
    activeCategory: activeCat,
    subCategories: subCatsOfActive,
    visibleItems,
    searchMatchedCategoryIds,
    activeCategoryForPanel: activeCatForPanel,
    navigationActiveId: navActiveId,
  } = deriveMenuManagerView({
    categories,
    items,
    activeCategoryId: activeCategory,
    activeSubCategoryId: activeSubCat,
    selectedItem,
    search,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MenuManagerTopBar
        restaurantName={restaurantName}
        restaurantSlug={restaurantSlug}
        search={search}
        searchFocused={searchFocused}
        searchInputRef={searchInputRef}
        importFileInputRef={csvImport.fileInputRef}
        onSearchChange={setSearch}
        onSearchFocusChange={setSearchFocused}
        onImportFileChange={csvImport.handleFileChange}
        onOpenImport={csvImport.openStart}
        onOpenAddItem={() => setShowAddItem(true)}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <MenuCategoryWorkspace
          categories={categories}
          items={items}
          kitchenStations={kitchenStations}
          activeId={navActiveId}
          restaurantId={restaurantId}
          visibleCategoryIds={searchMatchedCategoryIds}
          onSelect={handleSelectCategory}
          onCategoryAdded={addCategory}
          onCategoryUpdated={updateCategory}
          onCategoryDeleted={commands.removeCategory}
          onCategoriesReordered={commands.reorder}
        />

        <MenuItemsWorkspace
          items={visibleItems}
          activeCategory={activeCat}
          subCategories={subCatsOfActive}
          activeSubCat={activeSubCat}
          onSubCatChange={selectSubCategory}
          selectedItem={selectedItem}
          onSelectItem={selectItem}
          onAddItem={() => setShowAddItem(true)}
          onQuickUpdate={commands.quickUpdate}
          onBulkAvailability={commands.setBulkAvailability}
          highlight={search || undefined}
        />

        {selectedItem ? (
          <MenuItemEditPanel
            key={selectedItem.id}
            item={selectedItem}
            categoryName={activeCatForPanel?.name ?? ''}
            categoryVatRate={Number(activeCatForPanel?.vat_rate ?? 10)}
            categoryStationId={activeCatForPanel?.kitchen_station_id ?? null}
            kitchenStations={kitchenStations}
            restaurantId={restaurantId}
            onClose={closeItemEditor}
            onSaved={saveItem}
            onDeleted={removeItem}
            onError={showError}
            onDirtyChange={setItemEditDirty}
          />
        ) : (
          <MenuManagerEmptyPanel />
        )}
      </div>

      {toastMsg && <MenuManagerToast message={toastMsg} tone={toastTone} onDone={clearToast} />}

      {pendingEditorExit && (
        <UnsavedChangesDialog
          description="Bu üründe yaptığın değişiklikler henüz kaydedilmedi. Çıkarsan değişiklikler kalıcı olarak silinecek."
          onKeepEditing={keepEditing}
          onDiscard={discardPendingChanges}
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

      {showAddItem && (activeSubCat ?? activeCategory) && (
        <NewProductDrawer
          restaurantId={restaurantId}
          categoryId={(activeSubCat ?? activeCategory)!}
          categoryName={categories.find((c) => c.id === (activeSubCat ?? activeCategory))?.name ?? 'Kategori'}
          categoryStationId={categories.find((c) => c.id === (activeSubCat ?? activeCategory))?.kitchen_station_id ?? null}
          kitchenStations={kitchenStations}
          onCreated={createItem}
          onClose={() => setShowAddItem(false)}
        />
      )}
    </div>
  )
}
