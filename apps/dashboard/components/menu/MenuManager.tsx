'use client'
import { Toaster } from '@/components/ui/toast'
import type { Tables } from '@garsonless/db/types'
import NewProductDrawer from './NewProductDrawer'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { useRouter } from 'next/navigation'
import type { MenuItemRecommendationRow } from '@garsonless/db/server'
import { CsvImportModal, CsvImportStartModal } from './MenuCsvImportOverlays'
import { useMenuCsvImport } from './use-menu-csv-import'
import { deriveMenuManagerView } from './menu-manager-view-model'
import { MenuCategoryWorkspace } from './MenuCategoryWorkspace'
import { MenuItemEditPanel } from './MenuItemEditPanel'
import { MenuItemsWorkspace } from './MenuItemsWorkspace'
import { MenuManagerEmptyPanel, MenuManagerSkeleton, MenuManagerToast, MenuManagerTopBar } from './MenuManagerChrome'
import { useMenuManagerCommands } from './use-menu-manager-commands'
import { useMenuManagerShellState } from './use-menu-manager-shell-state'
import { useMenuItemRecommendations } from './use-menu-item-recommendations'
interface Props {
  restaurantId: string
  restaurantName: string
  publicMenuPath: string
  initialCategories: Tables<'menu_categories'>[]
  initialItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  initialRecommendations: MenuItemRecommendationRow[]
}
export default function MenuManager({ restaurantId, restaurantName, publicMenuPath, initialCategories, initialItems, kitchenStations, initialRecommendations }: Props) {
  const router = useRouter()
  const recommendations = useMenuItemRecommendations(initialRecommendations)
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
    categoryAddRequest,
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
    requestAddCategory,
    requestAddItem,
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
    <div
      className="menu-manager"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', overscrollBehaviorY: 'none' }}
    >
      <Toaster />
      <MenuManagerTopBar
        restaurantName={restaurantName}
        publicMenuPath={publicMenuPath}
        search={search}
        searchFocused={searchFocused}
        searchInputRef={searchInputRef}
        importFileInputRef={csvImport.fileInputRef}
        categoryCount={categories.length}
        onSearchChange={setSearch}
        onSearchFocusChange={setSearchFocused}
        onImportFileChange={csvImport.handleFileChange}
        onOpenImport={csvImport.openStart}
        onOpenAddCategory={requestAddCategory}
        onOpenAddItem={requestAddItem}
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
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
          addRequest={categoryAddRequest}
        />
        <MenuItemsWorkspace
          items={visibleItems}
          activeCategory={activeCat}
          subCategories={subCatsOfActive}
          activeSubCat={activeSubCat}
          onSubCatChange={selectSubCategory}
          selectedItem={selectedItem}
          onSelectItem={selectItem}
          canAddProduct={categories.length > 0}
          onAddCategory={requestAddCategory}
          onAddItem={requestAddItem}
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
            allItems={items}
            recommendationIds={recommendations.idsByItem.get(selectedItem.id)?.filter(Boolean) ?? []}
            restaurantId={restaurantId}
            onClose={closeItemEditor}
            onSaved={saveItem}
            onDeleted={removeItem}
            onError={showError}
            onDirtyChange={setItemEditDirty}
            onRecommendationsSaved={(ids) => recommendations.replaceForItem(selectedItem.id, ids)}
          />
        ) : (
          <MenuManagerEmptyPanel categoryCount={categories.length} itemCount={items.length} onAddCategory={requestAddCategory} onAddItem={requestAddItem} />
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
        <CsvImportModal preview={csvImport.preview} onConfirm={csvImport.importPreview} onCancel={csvImport.cancelPreview} onDownloadTemplate={csvImport.downloadTemplate} />
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
