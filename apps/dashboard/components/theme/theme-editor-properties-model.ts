import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField } from '@garsonless/ui'

export type EditorTab = 'design' | 'layout' | 'content'
type SectionFieldType = 'text' | 'textarea' | 'color' | 'range' | 'select' | 'url' | 'datetime' | 'toggle' | 'product-select' | 'category-select' | 'campaign-multi-select' | 'heading' | 'icon-grid'

export const THEME_EDITOR_THEME_GROUP_ID = 'theme'

export interface SectionSettingField {
  key: string
  label: string
  type: SectionFieldType
  editorTab: EditorTab
  placeholder?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  default?: string | number | boolean
  options?: Array<{ value: string; label: string }>
}

export const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'design', label: 'Tasarım' },
  { id: 'layout', label: 'Düzen' },
  { id: 'content', label: 'İçerik' },
]

export function getFieldEditorTab(field: SettingField, groupId = ''): EditorTab {
  if (field.editorTab) return field.editorTab
  if (
    groupId === 'layout' ||
    field.id.includes('Layout') ||
    field.id.includes('layout') ||
    field.id.includes('Align') ||
    field.id.includes('align') ||
    field.id.includes('sticky') ||
    field.id.includes('Height') ||
    field.id.includes('cols') ||
    field.id.includes('gap') ||
    field.id.includes('pad') ||
    field.id.includes('sectionGap') ||
    field.themeField === 'headerPadY' ||
    field.themeField === 'headerBottomGap' ||
    field.themeField === 'headerBorder' ||
    field.themeField === 'cardLayout' ||
    field.themeField === 'cardImageAspect' ||
    field.themeField === 'catnavStyle' ||
    field.themeField === 'catnavVisualStyle' ||
    field.themeField === 'cartStyle'
  ) {
    return 'layout'
  }
  if (
    groupId === 'content' ||
    field.type === 'text' ||
    field.id.includes('Text') ||
    field.id.includes('Tagline') ||
    field.id.includes('Description') ||
    field.id.includes('Show') ||
    field.themeField === 'headerTagline' ||
    field.themeField === 'pageDescription' ||
    field.themeField === 'cartButtonText' ||
    field.themeField === 'cartEmptyText' ||
    field.themeField === 'footerEnabled' ||
    field.themeField === 'cardShowDesc' ||
    field.themeField === 'cardShowTag' ||
    field.themeField === 'cartShowBadge' ||
    field.themeField === 'headerShowSearch' ||
    field.themeField === 'headerShowLang' ||
    field.themeField === 'headerShowMenu' ||
    field.themeField === 'headerTableBadge' ||
    field.themeField === 'headerShowBill'
  ) {
    return 'content'
  }
  return 'design'
}

export function getAvailableEditorTabs(fields: SettingField[], groupId = '') {
  return EDITOR_TABS.filter((tab) => fields.some((field) => getFieldEditorTab(field, groupId) === tab.id))
}

export function getAvailableSectionTabs(fields: SectionSettingField[]) {
  return EDITOR_TABS.filter((tab) => fields.some((field) => field.editorTab === tab.id))
}

export function resolveEffectiveEditorTab(
  availableTabs: Array<{ id: EditorTab }>,
  requestedTab: EditorTab,
): EditorTab {
  return availableTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : availableTabs[0]?.id ?? 'design'
}

export function getVisibleThemeFields(
  fields: SettingField[],
  groupId: string | undefined,
  theme: GarsonlessTheme,
  editorTab: EditorTab,
) {
  return fields.filter((field) => {
    const fieldKey = String(field.themeField)
    if (fieldKey.startsWith('catnavVisual') && theme.catnavStyle !== 'visual') return false
    if (fieldKey.startsWith('catnavOverlay') && (theme.catnavStyle !== 'visual' || theme.catnavVisualStyle !== 'overlay')) return false
    if (groupId === 'nav' && theme.catnavStyle === 'visual' && [
      'stickyNav', 'catnavAlign', 'catnavDensity', 'catnavItemGap', 'catnavFontSize',
      'catnavActiveStyle', 'catnavAutoCenter', 'catnavEdgeFade',
    ].includes(fieldKey)) return false
    if (fieldKey === 'headerNameSize' && theme.headerLogoStyle === 'image') return false
    if ((fieldKey === 'headerLogoSize' || fieldKey === 'logoShape' || fieldKey === 'logoShadow' || fieldKey === 'logoBorder' || fieldKey === 'logoBg') && theme.headerLogoStyle !== 'image') return false
    if (groupId === 'cards') {
      const layout = theme.cardLayout
      const showImage = theme.cardShowImage ?? true
      if (fieldKey === 'cardImageAspect' && (layout !== 'vertical' || !showImage)) return false
      if ((fieldKey === 'cardImageFit' || fieldKey === 'cardImagePosition') && (layout === 'minimal' || !showImage)) return false
      if (fieldKey === 'cardHorizontalImageWidth' && (layout !== 'horizontal' || !showImage)) return false
      if (field.id === 'cardColumns' && layout !== 'vertical') return false
      if ((fieldKey === 'cardCtaStyle' || fieldKey === 'cardCtaIcon') && layout === 'minimal') return false
      if (fieldKey === 'cardCtaIcon' && theme.cardCtaStyle !== 'icon') return false
      if (fieldKey === 'cardDescriptionLines' && !theme.cardShowDesc) return false
    }
    if (groupId === 'cart') {
      const footer = theme.cartFooterTriggerStyle ?? 'pill'
      if (fieldKey === 'cartHeaderTriggerStyle' && theme.cartPlacement !== 'header') return false
      if (fieldKey === 'cartFooterTriggerStyle' && theme.cartPlacement !== 'footer') return false
      if ((fieldKey === 'cartPillTone' || fieldKey === 'cartPillPosition') && footer !== 'pill') return false
      if (fieldKey === 'cartShowBadge' && theme.cartPlacement !== 'header' && theme.cartPlacement !== 'footer') return false
    }
    if (groupId === 'footer') {
      if (!theme.footerEnabled && fieldKey !== 'footerEnabled') return false
    }
    return getFieldEditorTab(field, groupId) === editorTab
  })
}
