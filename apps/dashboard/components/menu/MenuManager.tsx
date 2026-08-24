'use client'
import { Toaster } from '@/components/ui/toast'
import type { Tables } from '@garsonless/db/types'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { MenuItemRecommendationRow } from '@garsonless/db/server'
import { useMenuCsvImport } from './use-menu-csv-import'
import { deriveMenuManagerView } from './menu-manager-view-model'
import { MenuCategoryWorkspace } from './MenuCategoryWorkspace'
import { MenuItemsWorkspace } from './MenuItemsWorkspace'
import { MenuLiveNotice, MenuManagerEmptyPanel, MenuManagerSkeleton, MenuManagerToast, MenuManagerTopBar } from './MenuManagerChrome'
import { MenuManagerOverlays } from './MenuManagerOverlays'
import { useMenuManagerCommands } from './use-menu-manager-commands'
import { useMenuManagerShellState } from './use-menu-manager-shell-state'
import { useMenuItemRecommendations } from './use-menu-item-recommendations'
import { useMenuLiveState } from './use-menu-live-state'
const MenuItemEditPanel = dynamic(() => import('./MenuItemEditPanel').then((module) => module.MenuItemEditPanel), {
  loading: () => <div role="status" aria-live="polite" className="sr-only">Ürün editörü yükleniyor.</div>,
})
interface Props {
  restaurantId: string; restaurantName: string; publicMenuPath: string
  initialCategories: Tables<'menu_categories'>[]
  initialItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  initialRecommendations: MenuItemRecommendationRow[]
  recommendationsAvailable: boolean
}
export default function MenuManager({ restaurantId, restaurantName, publicMenuPath, initialCategories, initialItems, kitchenStations, initialRecommendations, recommendationsAvailable }: Props) {
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
    itemEditDirty,
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
    workspaceStage,
    goBack,
  } = shell
  const live = useMenuLiveState({
    restaurantId,
    hasUnsavedChanges: itemEditDirty,
    onRefresh: () => router.refresh(),
  })
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
      setCategories((current) => [
        ...current,
        ...createdCategories.filter((created) => !current.some((category) => category.id === created.id)),
      ])
    },
    onItemsCreated: (createdItems) => {
      setItems((current) => [
        ...current,
        ...createdItems.filter((created) => !current.some((item) => item.id === created.id)),
      ])
    },
    onComplete: (message, tone) => notify(message, tone),
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
  const mobileContext = workspaceStage === 'editor'
    ? (selectedItem?.name ?? 'Ürün düzenle')
    : workspaceStage === 'items'
      ? (search ? 'Arama sonuçları' : activeCat?.name ?? 'Ürünler')
      : 'Kategoriler'
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
        workspaceStage={workspaceStage}
        mobileContext={mobileContext}
        onMobileBack={goBack}
        onClearSearch={() => setSearch('')}
      />
      <MenuLiveNotice status={live.status} updatePending={live.updatePending} onRetry={live.retry} />
      <div
        className="menu-manager-workspace"
        data-workspace-stage={workspaceStage}
        style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}
      >
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
          categories={categories}
          searching={Boolean(search)}
          onClearSearch={() => setSearch('')}
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
            recommendationsAvailable={recommendationsAvailable}
            onRetryRecommendations={() => router.refresh()}
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
      <MenuManagerOverlays
        pendingEditorExit={pendingEditorExit}
        onKeepEditing={keepEditing}
        onDiscardChanges={discardPendingChanges}
        csvImport={csvImport}
        showAddItem={showAddItem}
        activeCategoryId={activeSubCat ?? activeCategory}
        categories={categories}
        kitchenStations={kitchenStations}
        restaurantId={restaurantId}
        onItemCreated={createItem}
        onCloseAddItem={() => setShowAddItem(false)}
      />
    </div>
  )
}
