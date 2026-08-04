'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import {
  getSectionDefinitionId,
  getUniqueSectionDefinitionIds,
  type GarsonlessTheme,
  type ThemeSectionVisibility,
} from '@garsonless/design-engine'
import type { SettingField, SettingsGroup } from '@garsonless/ui'
import {
  getAvailableEditorTabs,
  getAvailableSectionTabs,
  getVisibleThemeFields,
  resolveEffectiveEditorTab,
  THEME_EDITOR_THEME_GROUP_ID,
  type EditorTab,
  type SectionSettingField,
} from './theme-editor-properties-model'
import {
  SECTION_GROUPS,
  SECTION_LIBRARY,
  MENU_SECTION_LIBRARY,
  SECTION_SETTING_SCHEMA,
} from './theme-editor-section-registry'
import {
  addSectionToPageFlow,
  getKeyboardMoveTarget,
  removeSectionFromPageFlow,
  reorderPageBlocks,
  type MenuCategory,
  type PageBlock,
} from './theme-page-flow-model'
import {
  getTimedSectionInstances,
  pruneExpiredTimedSections,
} from './theme-timed-section-model'

type EditorNavGroup = {
  title: string
  items: Array<{ id: string; label: string; sub: string; icon: ReactNode }>
}

interface ThemeEditorNavigationOptions {
  schema: SettingsGroup[]
  themeGroupData: SettingsGroup
  navGroups: EditorNavGroup[]
  mergedTheme: GarsonlessTheme
  previewTheme: GarsonlessTheme
  menuCategories: MenuCategory[]
  updateThemePatch: (patch: Partial<GarsonlessTheme>) => void
  flashToast: (message: string) => void
}

interface ThemeEditorNavigationResult {
  activeGroup: string
  activeEditorTab: EditorTab
  sectionPickerOpen: boolean
  sectionSearch: string
  editorSearch: string
  editorQuery: string
  sectionGroup: (typeof SECTION_GROUPS)[number]
  selectedSectionId: string | null
  selectedSectionDefinitionId: string | null
  selectedSectionBlock: PageBlock | null
  dragBlockKey: string | null
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  sectionCloseRef: RefObject<HTMLButtonElement | null>
  pageBlocks: PageBlock[]
  activeSections: string[]
  activeSectionDefinitionIds: string[]
  activeGroupData: SettingsGroup | undefined
  filteredNavGroups: EditorNavGroup[]
  selectedSection: (typeof SECTION_LIBRARY)[number] | null | undefined
  selectedSectionSettings: Record<string, string>
  visibleEditorTabs: Array<{ id: EditorTab; label: string }>
  effectiveEditorTab: EditorTab
  visibleFields: SettingField[]
  visibleSectionFields: SectionSettingField[]
  filteredSections: Array<(typeof SECTION_LIBRARY)[number]>
  filteredPageBlocks: PageBlock[]
  setSectionSearch: Dispatch<SetStateAction<string>>
  setEditorSearch: Dispatch<SetStateAction<string>>
  setSectionGroup: Dispatch<SetStateAction<(typeof SECTION_GROUPS)[number]>>
  setDragBlockKey: Dispatch<SetStateAction<string | null>>
  setActiveEditorTab: Dispatch<SetStateAction<EditorTab>>
  openSectionPicker: () => void
  closeSectionPicker: () => void
  addSection: (sectionId: string) => void
  removeSection: (sectionId: string) => void
  changeSectionSetting: (sectionId: string, key: string, value: string) => void
  changeSectionVisibility: (visibility: ThemeSectionVisibility) => void
  changeSectionPlacement: (placement: 'page' | 'drawer') => void
  dropPageBlock: (targetKey: string) => void
  movePageBlock: (sourceKey: string, direction: -1 | 1) => void
  selectGroup: (groupId: string) => void
  selectPageBlock: (block: PageBlock) => void
}

export function useThemeEditorNavigation({
  schema,
  themeGroupData,
  navGroups,
  mergedTheme,
  previewTheme,
  menuCategories,
  updateThemePatch,
  flashToast,
}: ThemeEditorNavigationOptions): ThemeEditorNavigationResult {
  const [activeGroup, setActiveGroup] = useState(() =>
    schema.some((group) => ['colors', 'typography'].includes(group.id))
      ? THEME_EDITOR_THEME_GROUP_ID
      : schema[0]?.id ?? '',
  )
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('design')
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [sectionSearch, setSectionSearch] = useState('')
  const [editorSearch, setEditorSearch] = useState('')
  const [sectionGroup, setSectionGroup] = useState<(typeof SECTION_GROUPS)[number]>('Tümü')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [dragBlockKey, setDragBlockKey] = useState<string | null>(null)
  const sectionTriggerRef = useRef<HTMLButtonElement>(null)
  const sectionCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedBeforeDialogRef = useRef<HTMLElement | null>(null)

  const pageBlocks = useMemo(() => previewTheme.pageBlocks ?? [], [previewTheme.pageBlocks])
  const activeSections = useMemo(
    () => pageBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    [pageBlocks],
  )
  const activeSectionDefinitionIds = useMemo(
    () => pageBlocks.flatMap((block) => {
      const id = getSectionDefinitionId(block)
      return id ? [id] : []
    }),
    [pageBlocks],
  )
  const editorQuery = editorSearch.trim().toLocaleLowerCase('tr')

  const activeGroupData = activeGroup === THEME_EDITOR_THEME_GROUP_ID
    ? themeGroupData
    : schema.find((group) => group.id === activeGroup) ?? schema[0]
  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: editorQuery
        ? group.items.filter((item) =>
            `${item.label} ${item.sub}`.toLocaleLowerCase('tr').includes(editorQuery),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0)
  const activeFields = activeGroupData?.fields ?? []
  const selectedSectionBlock = selectedSectionId
    ? pageBlocks.find((block) => block.type === 'section' && block.id === selectedSectionId) ?? null
    : null
  const selectedSectionDefinitionId = selectedSectionBlock
    ? getSectionDefinitionId(selectedSectionBlock)
    : null
  const selectedSection = selectedSectionDefinitionId
    ? SECTION_LIBRARY.find((section) => section.id === selectedSectionDefinitionId)
    : null
  const selectedSectionSettings = selectedSectionId
    ? (mergedTheme.sectionSettings?.[selectedSectionId] ?? {})
    : {}
  const selectedSectionFields = selectedSectionDefinitionId
    ? (SECTION_SETTING_SCHEMA[selectedSectionDefinitionId] ?? SECTION_SETTING_SCHEMA.default ?? [])
    : []
  const activeAvailableTabs = getAvailableEditorTabs(activeFields, activeGroupData?.id)
  const sectionAvailableTabs = getAvailableSectionTabs(selectedSectionFields)
  const visibleEditorTabs = selectedSection ? sectionAvailableTabs : activeAvailableTabs
  const effectiveEditorTab = resolveEffectiveEditorTab(visibleEditorTabs, activeEditorTab)
  const visibleFields = getVisibleThemeFields(activeFields, activeGroupData?.id, mergedTheme, effectiveEditorTab)
  const visibleSectionFields = selectedSectionFields.filter((field) => field.editorTab === effectiveEditorTab)
  const filteredSections = MENU_SECTION_LIBRARY.filter((section) => {
    const matchesGroup = sectionGroup === 'Tümü' || section.group === sectionGroup
    const query = sectionSearch.trim().toLocaleLowerCase('tr')
    const matchesSearch = !query || `${section.label} ${section.sub} ${section.group}`.toLocaleLowerCase('tr').includes(query)
    return matchesGroup && matchesSearch
  })
  const filteredPageBlocks = editorQuery
    ? pageBlocks.filter((block) => {
        const preset = block.type === 'section'
          ? SECTION_LIBRARY.find((item) => item.id === getSectionDefinitionId(block))
          : null
        const category = block.type === 'category'
          ? menuCategories.find((item) => item.id === block.id)
          : null
        const label = block.type === 'nav'
          ? 'Kategori Menüsü Kaydırılabilir kategori navigasyonu'
          : block.type === 'section'
            ? `${preset?.label ?? block.id} ${preset?.sub ?? ''}`
            : `${category?.name ?? block.id} Menü kategorisi`
        return label.toLocaleLowerCase('tr').includes(editorQuery)
      })
    : pageBlocks

  const openSectionPicker = useCallback(() => {
    lastFocusedBeforeDialogRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setSectionPickerOpen(true)
  }, [])

  const closeSectionPicker = useCallback(() => {
    setSectionPickerOpen(false)
    requestAnimationFrame(() => {
      ;(lastFocusedBeforeDialogRef.current ?? sectionTriggerRef.current)?.focus()
    })
  }, [])

  const addSection = useCallback((sectionId: string) => {
    const nextBlocks = addSectionToPageFlow(pageBlocks, sectionId)
    const addedBlock = nextBlocks.find(
      (block) => block.type === 'section' && !activeSections.includes(block.id),
    )
    if (!addedBlock) return
    const isAdditionalInstance = addedBlock.id !== sectionId
    const nextSectionSettings = isAdditionalInstance
      ? {
          ...(mergedTheme.sectionSettings ?? {}),
          [addedBlock.id]: {
            ...(mergedTheme.sectionSettings?.[sectionId] ?? {}),
          },
        }
      : mergedTheme.sectionSettings
    updateThemePatch({
      sections: getUniqueSectionDefinitionIds(nextBlocks),
      pageBlocks: nextBlocks,
      ...(isAdditionalInstance ? { sectionSettings: nextSectionSettings } : {}),
    })
    setSectionPickerOpen(false)
    setActiveEditorTab('content')
    setSelectedSectionId(addedBlock.id)
  }, [activeSections, mergedTheme.sectionSettings, pageBlocks, updateThemePatch])

  const removeSection = useCallback((sectionId: string) => {
    const nextSettings = { ...(mergedTheme.sectionSettings ?? {}) }
    delete nextSettings[sectionId]
    updateThemePatch({
      sections: getUniqueSectionDefinitionIds(removeSectionFromPageFlow(pageBlocks, sectionId)),
      pageBlocks: removeSectionFromPageFlow(pageBlocks, sectionId),
      sectionSettings: nextSettings,
    })
    if (selectedSectionId === sectionId) setSelectedSectionId(null)
  }, [mergedTheme.sectionSettings, pageBlocks, selectedSectionId, updateThemePatch])

  const timedSectionInstances = useMemo(
    () => getTimedSectionInstances(pageBlocks, mergedTheme.sectionSettings),
    [mergedTheme.sectionSettings, pageBlocks],
  )

  useEffect(() => {
    if (timedSectionInstances.length === 0) return
    let timeout: number | undefined

    const reconcileExpiredSections = () => {
      const now = Date.now()
      const result = pruneExpiredTimedSections(pageBlocks, mergedTheme.sectionSettings, now)
      if (result.expiredIds.length > 0) {
        const expired = new Set(result.expiredIds)
        updateThemePatch({
          sections: getUniqueSectionDefinitionIds(result.pageBlocks),
          pageBlocks: result.pageBlocks,
          sectionSettings: result.sectionSettings,
        })
        setSelectedSectionId((current) => current && expired.has(current) ? null : current)
        flashToast('Süresi dolan kampanya sayfa akışından kaldırıldı')
        return
      }

      const nextExpiry = Math.min(...timedSectionInstances.map((section) => section.endsAtMs))
      const delay = Math.min(Math.max(50, nextExpiry - now + 50), 2_147_000_000)
      timeout = window.setTimeout(reconcileExpiredSections, delay)
    }

    reconcileExpiredSections()
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
    }
  }, [
    flashToast,
    mergedTheme.sectionSettings,
    pageBlocks,
    timedSectionInstances,
    updateThemePatch,
  ])

  const changeSectionSetting = useCallback((sectionId: string, key: string, value: string) => {
    const currentSettings = mergedTheme.sectionSettings?.[sectionId] ?? {}
    const nextSettings = { ...currentSettings, [key]: value }
    if (key === 'targetType') {
      nextSettings.targetId = ''
      nextSettings.targetUrl = ''
    }
    updateThemePatch({
      sectionSettings: {
        ...(mergedTheme.sectionSettings ?? {}),
        [sectionId]: nextSettings,
      },
    })
  }, [mergedTheme.sectionSettings, updateThemePatch])

  const changeSectionVisibility = useCallback((visibility: ThemeSectionVisibility) => {
    if (!selectedSectionId) return
    updateThemePatch({
      pageBlocks: pageBlocks.map((block) =>
        block.type === 'section' && block.id === selectedSectionId
          ? { ...block, visibility }
          : block,
      ),
    })
  }, [pageBlocks, selectedSectionId, updateThemePatch])

  const changeSectionPlacement = useCallback((placement: 'page' | 'drawer') => {
    if (!selectedSectionId) return
    updateThemePatch({
      pageBlocks: pageBlocks.map((block) =>
        block.type === 'section' && block.id === selectedSectionId
          ? { ...block, placement }
          : block,
      ),
    })
  }, [pageBlocks, selectedSectionId, updateThemePatch])

  const reorderPageBlock = useCallback((sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return
    const result = reorderPageBlocks(pageBlocks, menuCategories, sourceKey, targetKey)
    if (!result.ok) {
      if (result.reason === 'child-scope') {
        flashToast('Alt kategoriler yalnızca kendi üst kategorisi altında sıralanabilir')
      } else if (result.reason === 'nested-target') {
        flashToast('Bu alan alt kategori kapsamı; üst öğeleri buraya taşıyamazsınız')
      }
      setDragBlockKey(null)
      return
    }
    const { blocks: nextBlocks, moved } = result
    updateThemePatch({
      pageBlocks: nextBlocks,
      sections: getUniqueSectionDefinitionIds(nextBlocks),
    })
    setDragBlockKey(null)
    const movedLabel = moved.type === 'category'
      ? menuCategories.find((item) => item.id === moved.id)?.name ?? 'Kategori'
      : moved.type === 'nav'
        ? 'Kategori Menüsü'
        : SECTION_LIBRARY.find((item) => item.id === getSectionDefinitionId(moved))?.label ?? 'Bölüm'
    flashToast(`${movedLabel} taşındı`)
  }, [flashToast, menuCategories, pageBlocks, updateThemePatch])

  const dropPageBlock = useCallback((targetKey: string) => {
    if (!dragBlockKey || editorQuery) return
    reorderPageBlock(dragBlockKey, targetKey)
  }, [dragBlockKey, editorQuery, reorderPageBlock])

  const movePageBlock = useCallback((sourceKey: string, direction: -1 | 1) => {
    if (editorQuery) return
    const targetKey = getKeyboardMoveTarget(pageBlocks, menuCategories, sourceKey, direction)
    if (targetKey) reorderPageBlock(sourceKey, targetKey)
  }, [editorQuery, menuCategories, pageBlocks, reorderPageBlock])

  const selectGroup = useCallback((groupId: string) => {
    setActiveGroup(groupId)
    setSelectedSectionId(null)
    const group = groupId === THEME_EDITOR_THEME_GROUP_ID
      ? themeGroupData
      : schema.find((candidate) => candidate.id === groupId)
    const firstTab = getAvailableEditorTabs(group?.fields ?? [], group?.id)[0]?.id
    if (firstTab) setActiveEditorTab(firstTab)
  }, [schema, themeGroupData])

  const selectPageBlock = useCallback((block: PageBlock) => {
    if (block.type === 'section') {
      setSelectedSectionId(block.id)
      setActiveEditorTab('content')
    } else if (block.type === 'nav') {
      setSelectedSectionId(null)
      setActiveGroup('nav')
      setActiveEditorTab('design')
    } else {
      setSelectedSectionId(null)
    }
  }, [])

  return {
    activeGroup,
    activeEditorTab,
    sectionPickerOpen,
    sectionSearch,
    editorSearch,
    editorQuery,
    sectionGroup,
    selectedSectionId,
    selectedSectionDefinitionId,
    selectedSectionBlock,
    dragBlockKey,
    sectionTriggerRef,
    sectionCloseRef,
    pageBlocks,
    activeSections,
    activeSectionDefinitionIds,
    activeGroupData,
    filteredNavGroups,
    selectedSection,
    selectedSectionSettings,
    visibleEditorTabs,
    effectiveEditorTab,
    visibleFields,
    visibleSectionFields,
    filteredSections,
    filteredPageBlocks,
    setSectionSearch,
    setEditorSearch,
    setSectionGroup,
    setDragBlockKey,
    setActiveEditorTab,
    openSectionPicker,
    closeSectionPicker,
    addSection,
    removeSection,
    changeSectionSetting,
    changeSectionVisibility,
    changeSectionPlacement,
    dropPageBlock,
    movePageBlock,
    selectGroup,
    selectPageBlock,
  }
}
