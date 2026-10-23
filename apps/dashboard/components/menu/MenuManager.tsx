'use client'
import { MenuDraftProvider, useMenuDraft, useMenuDrafts } from './MenuDraftProvider'
import { Toaster } from '@/components/ui/toast'
import type { MenuItemRecommendationRow, Tables } from '@garsonless/db/types'
import dynamic from 'next/dynamic'
import { useMenuBulkController } from './use-menu-bulk-controller'
import { useRouter } from 'next/navigation'
import { useMenuCsvImport } from './use-menu-csv-import'
import { deriveMenuManagerView } from './menu-manager-view-model'
import { MenuCategoryWorkspace } from './MenuCategoryWorkspace'
import { MenuItemsWorkspace } from './MenuItemsWorkspace'
import { MenuLiveNotice, MenuManagerSkeleton, MenuManagerToast, MenuManagerTopBar } from './MenuManagerChrome'
import { MenuManagerOverlays } from './MenuManagerOverlays'
import { useMenuManagerCommands } from './use-menu-manager-commands'
import { useMenuManagerShellState } from './use-menu-manager-shell-state'
import { useMenuItemRecommendations } from './use-menu-item-recommendations'
import { useMenuLiveState } from './use-menu-live-state'
const MenuItemEditPanel = dynamic(() => import('./MenuItemEditPanel').then((module) => module.MenuItemEditPanel), {
  loading: () => <div role="status" aria-live="polite" className="sr-only">Ürün editörü yükleniyor.</div>,
})
const MenuBulkEditor = dynamic(() => import('./MenuBulkEditor'), { ssr: false })
interface Props {
  restaurantId: string; restaurantName: string; publicMenuPath: string
  initialCategories: Tables<'menu_categories'>[]; initialItems: Tables<'menu_items'>[]
  kitchenStations: Tables<'kitchen_stations'>[]
  initialRecommendations: MenuItemRecommendationRow[]; recommendationsAvailable: boolean
  orderingFeaturesEnabled: boolean; loyaltyStampEnabled: boolean
}
export default function MenuManager(props: Props) {
  return <MenuDraftProvider><MenuManagerContent {...props} /></MenuDraftProvider>
}
function MenuManagerContent({ restaurantId, restaurantName, publicMenuPath, initialCategories, initialItems, kitchenStations, initialRecommendations, recommendationsAvailable, orderingFeaturesEnabled, loyaltyStampEnabled }: Props) {
  const router = useRouter()
  const { registry, requestExit } = useMenuDrafts()
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
    showAddItem,
    closeAddItem,
    categoryAddRequest,
    search,
    setSearch,
    searchFocused,
    setSearchFocused,
    searchInputRef, statusFilter, setStatusFilter,
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
    workspaceStage,
    goBack,
  } = shell
  const commands = useMenuManagerCommands({
    restaurantId,
    categories,
    setCategories,
    items,
    setItems,
    setActiveCategory,
    setActiveSubCategory: setActiveSubCat,
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
  useMenuDraft(false, commands.pending || Boolean(csvImport.preview?.importing), () => {})
  const live = useMenuLiveState({
    restaurantId,
    hasUnsavedChanges: registry.dirty || registry.pending,
    onRefresh: () => router.refresh(),
  })
  const bulk = useMenuBulkController({ items, setItems, setSelectedItem, pending: commands.pending, onError: showError, onSuccess: showSuccess, onRefresh: () => router.refresh() })
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
    ? (selectedItem?.name ?? (showAddItem ? 'Yeni ürün' : 'Ürün düzenle'))
    : workspaceStage === 'items'
      ? (search ? 'Arama sonuçları' : 'Menü')
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
        categoryCount={categories.length} onBulkAll={() => bulk.open('all')} onBulkHistory={() => bulk.open([])} itemCount={items.length}
        onSearchChange={setSearch}
        onSearchFocusChange={setSearchFocused}
        onImportFileChange={csvImport.handleFileChange}
        onOpenImport={() => requestExit(csvImport.openStart)}
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
          visibleCategoryIds={searchMatchedCategoryIds} countStatus={statusFilter}
          onSelect={handleSelectCategory}
          onCategoryAdded={addCategory}
          onCategoryUpdated={updateCategory}
          onCategoryDeleted={commands.removeCategory}
          onCategoriesReordered={commands.reorder}
          addRequest={categoryAddRequest}
        />
        <MenuItemsWorkspace
          items={visibleItems} filter={statusFilter} onFilterChange={setStatusFilter}
          activeCategory={activeCat}
          subCategories={subCatsOfActive}
          activeSubCat={activeSubCat}
          onSubCatChange={selectSubCategory}
          selectedItem={selectedItem}
          onSelectItem={(item) => { if (!commands.pendingItemIds.has(item.id)) selectItem(item) }}
          onAddCategory={requestAddCategory}
          onAddItem={requestAddItem} onImport={() => requestExit(csvImport.openStart)}
          onAddToCategory={(id) => requestAddItem(undefined, id)}
          pendingItemIds={commands.pendingItemIds}
          structuralPending={commands.structuralPending}
          editingItemId={selectedItem?.id}
          onQuickUpdate={commands.quickUpdate}
          onBulkAvailability={commands.setBulkAvailability} onBulkDelete={commands.deleteBulk} onBulkEdit={bulk.open} onReorderItems={commands.reorderItems} onMoveItem={commands.moveItem}
          highlight={search || undefined}
          categories={categories}
          onClearSearch={() => setSearch('')}
        />
        {selectedItem ? (
          <MenuItemEditPanel
            key={`${selectedItem.id}:${selectedItem.updated_at}`}
            item={selectedItem}
            externalPending={commands.pendingItemIds.has(selectedItem.id) || commands.structuralPending}
            categories={categories}
            categoryVatRate={Number(activeCatForPanel?.vat_rate ?? 10)}
            categoryStationId={activeCatForPanel?.kitchen_station_id ?? null}
            kitchenStations={kitchenStations}
            allItems={items}
            recommendationIds={recommendations.idsByItem.get(selectedItem.id)?.filter(Boolean) ?? []}
            recommendationsAvailable={recommendationsAvailable}
            orderingFeaturesEnabled={orderingFeaturesEnabled} loyaltyStampEnabled={loyaltyStampEnabled}
            onRetryRecommendations={() => router.refresh()}
            restaurantId={restaurantId}
            onClose={closeItemEditor}
            onSaved={saveItem}
            onDeleted={removeItem}
            onError={showError}
            onRecommendationsSaved={(ids) => recommendations.replaceForItem(selectedItem.id, ids)}
          />
        ) : null}
      <MenuManagerOverlays
        csvImport={csvImport}
        showAddItem={showAddItem}
        activeCategoryId={activeSubCat ?? activeCategory}
        categories={categories}
        kitchenStations={kitchenStations}
        restaurantId={restaurantId} loyaltyStampEnabled={loyaltyStampEnabled}
        onItemCreated={createItem}
        onCloseAddItem={closeAddItem}
      />
      </div>
      {toastMsg && <MenuManagerToast message={toastMsg} tone={toastTone} onDone={clearToast} />}
      {bulk.selection && <MenuBulkEditor restaurantId={restaurantId} items={bulk.selection} categories={categories} historyOnly={bulk.selection.length === 0} scope={bulk.scope} onClose={bulk.close} onApplied={bulk.applied} />}
    </div>
  )
}
