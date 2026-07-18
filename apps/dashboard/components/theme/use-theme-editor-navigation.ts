'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { THEME_REGISTRY } from '@garsonless/ui'
import type { SettingField, SettingsGroup, ThemeRegistryEntry } from '@garsonless/ui'
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

type EditorNavGroup = {
  title: string
  items: Array<{ id: string; label: string; sub: string; icon: ReactNode }>
}

interface ThemeEditorNavigationOptions {
  restaurantId: string
  templateId: string
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
  templatePickerOpen: boolean
  sectionPickerOpen: boolean
  sectionSearch: string
  editorSearch: string
  editorQuery: string
  sectionGroup: (typeof SECTION_GROUPS)[number]
  selectedSectionId: string | null
  dragBlockKey: string | null
  templateTriggerRef: RefObject<HTMLButtonElement | null>
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  templateCloseRef: RefObject<HTMLButtonElement | null>
  sectionCloseRef: RefObject<HTMLButtonElement | null>
  pageBlocks: PageBlock[]
  activeSections: string[]
  templateEntries: ThemeRegistryEntry[]
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
  setTemplatePickerOpen: Dispatch<SetStateAction<boolean>>
  setSectionSearch: Dispatch<SetStateAction<string>>
  setEditorSearch: Dispatch<SetStateAction<string>>
  setSectionGroup: Dispatch<SetStateAction<(typeof SECTION_GROUPS)[number]>>
  setDragBlockKey: Dispatch<SetStateAction<string | null>>
  setActiveEditorTab: Dispatch<SetStateAction<EditorTab>>
  closeTemplatePicker: () => void
  openSectionPicker: () => void
  closeSectionPicker: () => void
  selectTemplate: (nextTemplateId: string) => void
  addSection: (sectionId: string) => void
  removeSection: (sectionId: string) => void
  changeSectionSetting: (sectionId: string, key: string, value: string) => void
  dropPageBlock: (targetKey: string) => void
  movePageBlock: (sourceKey: string, direction: -1 | 1) => void
  selectGroup: (groupId: string) => void
  selectPageBlock: (block: PageBlock) => void
}

export function useThemeEditorNavigation({
  restaurantId,
  templateId,
  schema,
  themeGroupData,
  navGroups,
  mergedTheme,
  previewTheme,
  menuCategories,
  updateThemePatch,
  flashToast,
}: ThemeEditorNavigationOptions): ThemeEditorNavigationResult {
  const router = useRouter()
  const [activeGroup, setActiveGroup] = useState(() =>
    schema.some((group) => ['colors', 'typography'].includes(group.id))
      ? THEME_EDITOR_THEME_GROUP_ID
      : schema[0]?.id ?? '',
  )
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('design')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [sectionSearch, setSectionSearch] = useState('')
  const [editorSearch, setEditorSearch] = useState('')
  const [sectionGroup, setSectionGroup] = useState<(typeof SECTION_GROUPS)[number]>('Tümü')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [dragBlockKey, setDragBlockKey] = useState<string | null>(null)
  const templateTriggerRef = useRef<HTMLButtonElement>(null)
  const sectionTriggerRef = useRef<HTMLButtonElement>(null)
  const templateCloseRef = useRef<HTMLButtonElement>(null)
  const sectionCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedBeforeDialogRef = useRef<HTMLElement | null>(null)

  const pageBlocks = useMemo(() => previewTheme.pageBlocks ?? [], [previewTheme.pageBlocks])
  const activeSections = useMemo(
    () => pageBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    [pageBlocks],
  )
  const editorQuery = editorSearch.trim().toLocaleLowerCase('tr')
  const templateEntries = useMemo(() => Object.values(THEME_REGISTRY).sort((a, b) => {
    if (a.id === templateId) return -1
    if (b.id === templateId) return 1
    return 0
  }), [templateId])

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
  const selectedSection = selectedSectionId
    ? SECTION_LIBRARY.find((section) => section.id === selectedSectionId)
    : null
  const selectedSectionSettings = selectedSectionId
    ? (mergedTheme.sectionSettings?.[selectedSectionId] ?? {})
    : {}
  const selectedSectionFields = selectedSectionId
    ? (SECTION_SETTING_SCHEMA[selectedSectionId] ?? SECTION_SETTING_SCHEMA.default ?? [])
    : []
  const activeAvailableTabs = getAvailableEditorTabs(activeFields, activeGroupData?.id)
  const sectionAvailableTabs = getAvailableSectionTabs(selectedSectionFields)
  const visibleEditorTabs = selectedSection ? sectionAvailableTabs : activeAvailableTabs
  const effectiveEditorTab = resolveEffectiveEditorTab(visibleEditorTabs, activeEditorTab)
  const visibleFields = getVisibleThemeFields(activeFields, activeGroupData?.id, mergedTheme, effectiveEditorTab)
  const visibleSectionFields = selectedSectionFields.filter((field) => field.editorTab === effectiveEditorTab)
  const filteredSections = SECTION_LIBRARY.filter((section) => {
    const matchesGroup = sectionGroup === 'Tümü' || section.group === sectionGroup
    const query = sectionSearch.trim().toLocaleLowerCase('tr')
    const matchesSearch = !query || `${section.label} ${section.sub} ${section.group}`.toLocaleLowerCase('tr').includes(query)
    return matchesGroup && matchesSearch
  })
  const filteredPageBlocks = editorQuery
    ? pageBlocks.filter((block) => {
        const preset = block.type === 'section'
          ? SECTION_LIBRARY.find((item) => item.id === block.id)
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

  const closeTemplatePicker = useCallback(() => {
    setTemplatePickerOpen(false)
    requestAnimationFrame(() => {
      ;(lastFocusedBeforeDialogRef.current ?? templateTriggerRef.current)?.focus()
    })
  }, [])

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

  const selectTemplate = useCallback((nextTemplateId: string) => {
    if (nextTemplateId === templateId) {
      closeTemplatePicker()
      return
    }
    closeTemplatePicker()
    router.push(`/dashboard/${restaurantId}/theme/${nextTemplateId}/edit`)
  }, [closeTemplatePicker, restaurantId, router, templateId])

  useEffect(() => {
    if (!templatePickerOpen && !sectionPickerOpen) return
    const closeRef = templatePickerOpen ? templateCloseRef : sectionCloseRef
    requestAnimationFrame(() => closeRef.current?.focus())
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (templatePickerOpen) closeTemplatePicker()
      if (sectionPickerOpen) closeSectionPicker()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeSectionPicker, closeTemplatePicker, sectionPickerOpen, templatePickerOpen])

  const addSection = useCallback((sectionId: string) => {
    if (activeSections.includes(sectionId)) {
      setSectionPickerOpen(false)
      setSelectedSectionId(sectionId)
      return
    }
    const nextBlocks = addSectionToPageFlow(pageBlocks, sectionId)
    updateThemePatch({
      sections: [...activeSections, sectionId],
      pageBlocks: nextBlocks,
    })
    setSectionPickerOpen(false)
    setActiveEditorTab('content')
    setSelectedSectionId(sectionId)
  }, [activeSections, pageBlocks, updateThemePatch])

  const removeSection = useCallback((sectionId: string) => {
    const nextSettings = { ...(mergedTheme.sectionSettings ?? {}) }
    delete nextSettings[sectionId]
    updateThemePatch({
      sections: activeSections.filter((id) => id !== sectionId),
      pageBlocks: removeSectionFromPageFlow(pageBlocks, sectionId),
      sectionSettings: nextSettings,
    })
    if (selectedSectionId === sectionId) setSelectedSectionId(null)
  }, [activeSections, mergedTheme.sectionSettings, pageBlocks, selectedSectionId, updateThemePatch])

  const hasDailySpecial = activeSections.includes('daily-special')
  const dailySpecialTimer = (mergedTheme.sectionSettings?.['daily-special']?.['timer'] as string | undefined) ?? ''

  useEffect(() => {
    if (!hasDailySpecial) return
    const match = dailySpecialTimer.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return
    const isExpired = () => {
      const target = new Date()
      target.setHours(Number(match[1]), Number(match[2]), 0, 0)
      return target.getTime() - Date.now() <= 0
    }
    if (isExpired()) {
      removeSection('daily-special')
      return
    }
    const timer = setInterval(() => {
      if (isExpired()) removeSection('daily-special')
    }, 1_000)
    return () => clearInterval(timer)
  }, [dailySpecialTimer, hasDailySpecial, removeSection])

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
      sections: nextBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    })
    setDragBlockKey(null)
    const movedLabel = moved.type === 'category'
      ? menuCategories.find((item) => item.id === moved.id)?.name ?? 'Kategori'
      : moved.type === 'nav'
        ? 'Kategori Menüsü'
        : SECTION_LIBRARY.find((item) => item.id === moved.id)?.label ?? 'Bölüm'
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
    templatePickerOpen,
    sectionPickerOpen,
    sectionSearch,
    editorSearch,
    editorQuery,
    sectionGroup,
    selectedSectionId,
    dragBlockKey,
    templateTriggerRef,
    sectionTriggerRef,
    templateCloseRef,
    sectionCloseRef,
    pageBlocks,
    activeSections,
    templateEntries,
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
    setTemplatePickerOpen,
    setSectionSearch,
    setEditorSearch,
    setSectionGroup,
    setDragBlockKey,
    setActiveEditorTab,
    closeTemplatePicker,
    openSectionPicker,
    closeSectionPicker,
    selectTemplate,
    addSection,
    removeSection,
    changeSectionSetting,
    dropPageBlock,
    movePageBlock,
    selectGroup,
    selectPageBlock,
  }
}
