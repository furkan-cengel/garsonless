import type { SettingsGroup } from '@garsonless/ui/themes'
import { I } from '../../lib/ui'
import { THEME_EDITOR_THEME_GROUP_ID } from './theme-editor-properties-model'

const THEME_GROUP_SOURCE_IDS = new Set(['colors', 'typography'])
const HEADER_GROUP_IDS = new Set(['header', 'header-layout', 'header-context', 'header-actions', 'drawer'])

const ORDERING_THEME_FIELD_IDS = new Set([
  'cartPlacement',
  'cartStyle',
  'cartHeaderTriggerStyle',
  'cartFooterTriggerStyle',
  'cartIcon',
  'cartShowBadge',
  'cartPillPosition',
  'cartPillTone',
  'cartDrawerTone',
  'cartShowSubtotal',
  'cartShowItemCount',
  'cartPrimaryActionText',
  'cartButtonText',
  'cartEmptyText',
])

export function restrictOrderingThemeSchema(schema: SettingsGroup[], canUseGuestOrdering: boolean) {
  if (canUseGuestOrdering) return schema
  return schema.map((group) => ({
    ...group,
    fields: group.id === 'cart'
      ? []
      : group.fields.filter((field) => !ORDERING_THEME_FIELD_IDS.has(field.themeField)),
  }))
}

export function buildEditorNavigation(
  schema: SettingsGroup[],
  themeName: string,
  lockedGroupIds: ReadonlySet<string> = new Set(),
) {
  const visibleSchema = schema.filter((group) => !THEME_GROUP_SOURCE_IDS.has(group.id))
  const headerGroups = visibleSchema.filter((group) => HEADER_GROUP_IDS.has(group.id))
  const remaining = visibleSchema.filter((group) => !HEADER_GROUP_IDS.has(group.id))
  const splitIndex = Math.ceil(remaining.length / 2)
  const structure = [
    ...headerGroups.map((group) => ({
      ...toNavigationItem(group, lockedGroupIds),
      label: group.id === 'header' ? 'Logo ve Marka' : group.label,
      parentLabel: 'Header',
      depth: 1,
    })),
    ...remaining.slice(0, splitIndex).map((group) => toNavigationItem(group, lockedGroupIds)),
  ]
  const style = [
    ...(schema.some((group) => THEME_GROUP_SOURCE_IDS.has(group.id))
      ? [{
          id: THEME_EDITOR_THEME_GROUP_ID,
          label: 'Tema',
          sub: 'Renkler ve tipografi',
          icon: <I.palette size={17} />,
        }]
      : []),
    ...remaining.slice(splitIndex).map((group) => toNavigationItem(group, lockedGroupIds)),
  ]

  return [
    { title: 'Sayfa Yapısı', items: structure },
    { title: 'Genel Stil', items: style },
  ].filter((group) => group.items.length > 0 || themeName)
}

export function buildThemeSettingsGroup(schema: SettingsGroup[]): SettingsGroup {
  return {
    id: THEME_EDITOR_THEME_GROUP_ID,
    label: 'Tema',
    fields: schema
      .filter((group) => THEME_GROUP_SOURCE_IDS.has(group.id))
      .flatMap((group) => group.fields),
  }
}

function toNavigationItem(group: SettingsGroup, lockedGroupIds: ReadonlySet<string>) {
  return {
    id: group.id,
    label: group.label,
    sub: getNavigationSubtitle(group.id, group.label),
    icon: getNavigationIcon(group.id),
    locked: lockedGroupIds.has(group.id),
  }
}

function getNavigationSubtitle(id: string, label: string) {
  if (id.includes('surface')) return 'Arka plan, renkler'
  if (id.includes('topbar')) return 'Logo, navigasyon'
  if (id.includes('welcome')) return 'Giriş metni'
  if (id.includes('menu')) return 'Kaydırılabilir kartlar'
  if (id.includes('dish')) return 'Ürün listesi'
  if (id.includes('payment')) return 'Alt ödeme akışı'
  if (id === 'footer') return 'Sosyal medya ve iletişim'
  if (id === 'colors') return 'Marka renkleri'
  if (id === 'typography') return 'Font ve ölçek'
  if (id === 'layout') return 'Izgara ve boşluk'
  return label
}

function getNavigationIcon(id: string) {
  if (id.includes('header') || id.includes('topbar')) return <I.header size={17} />
  if (id === 'drawer') return <I.menu size={17} />
  if (id.includes('cat') || id.includes('menu')) return <I.section size={17} />
  if (id.includes('card') || id.includes('dish')) return <I.card size={17} />
  if (id.includes('cart') || id.includes('payment')) return <I.cart size={17} />
  if (id === 'footer') return <I.layout size={17} />
  if (id.includes('color') || id.includes('surface')) return <I.color size={17} />
  if (id.includes('type') || id.includes('welcome')) return <I.type size={17} />
  if (id.includes('layout') || id.includes('spacing')) return <I.layout size={17} />
  return <I.page size={17} />
}
