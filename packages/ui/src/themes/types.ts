import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { ComponentType, ReactNode } from 'react'
import type { MenuCategory, MenuItem, SectionPromotionContext } from '../menu/types'
import type { ServiceRequestType } from '@garsonless/domain/tables'

export interface ComboAddRequest {
  sectionInstanceId: string
  comboIndex: number
  title: string
  items: MenuItem[]
  catalogTotal: number
  total: number
}

export interface ThemeMenuPageProps {
  categories: MenuCategory[]
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }>
  renderItems: (catId: string) => ReactNode
  menuFilters?: ReactNode
  orderStatus?: ReactNode
  filterEmptyState?: ReactNode
  tableId?: string | null
  tableLabel?: string | null
  cartSummary?: { count: number; subtotal: number }
  onOpenCart?: () => void
  items?: MenuItem[]
  onQuickAdd?: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => void
  onAddCombo?: (combo: ComboAddRequest) => void
  billSummary?: { total: number; count: number } | null
  onOpenBill?: (() => void) | undefined
  memberSummary?: MemberChipSummary | null
  onOpenMember?: (() => void) | undefined
  onServiceRequest?: ((type: ServiceRequestType) => Promise<boolean>) | undefined
  onOpenServiceRequests?: (() => void) | undefined
  /** Real member loyalty for the promo-slider loyalty slide (null → demo values). */
  memberLoyalty?: { filled: number; total: number } | null
  storeInfo?: StoreInfo | null
}

export interface StoreInfo {
  contact?: {
    phone?: string
    email?: string
    website?: string
    address?: string
    district?: string
    city?: string
    zip?: string
    instagram?: string
    facebook?: string
    tiktok?: string
    whatsapp?: string
  } | null
  hours?: Record<string, { open?: string; close?: string; active?: boolean }> | null
}

export interface MemberChipSummary {
  name: string | null
  stamps?: number
  stampGoal?: number
  points?: number
  stampEnabled?: boolean
  pointsEnabled?: boolean
  /** Join teaser for NON-members: welcome bonus points. 0/absent → plain "Üye ol". */
  welcomeBonus?: number
}

export interface SettingOption {
  value: string
  label: string
}

export interface SettingField {
  id: string
  label: string
  type: 'color' | 'range' | 'select' | 'toggle' | 'font' | 'text'
  editorTab?: 'design' | 'layout' | 'content'
  cssVar?: string
  themeField: keyof GarsonlessTheme
  default: unknown
  options?: SettingOption[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface SettingsGroup {
  id: string
  label: string
  fields: SettingField[]
}

export interface ThemeRegistryEntry {
  id: string
  name: string
  SETTINGS_SCHEMA: SettingsGroup[]
  THEME_DEFAULTS: GarsonlessTheme
  MenuPage: ComponentType<ThemeMenuPageProps>
}
