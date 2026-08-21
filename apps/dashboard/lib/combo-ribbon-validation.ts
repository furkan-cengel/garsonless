import type { GarsonlessTheme } from '@garsonless/design-engine'
import { resolveComboRibbonSelection } from '@garsonless/domain/menu'

export interface ComboRibbonMenuItemRef {
  id: string
  name: string
  categoryId?: string
  categoryName?: string
  price?: number
  isAvailable?: boolean
  position?: number
}

export function getComboRibbonSettingIssues(
  values: Record<string, string>,
  menuItems: ComboRibbonMenuItemRef[],
) {
  const byId = new Map(menuItems.map((item) => [item.id, item]))
  const resolved = resolveComboRibbonSelection(values, menuItems.map((item, index) => ({
    id: item.id,
    price: Number.isFinite(item.price) ? Number(item.price) : 0,
    position: item.position ?? index,
    isAvailable: item.isAvailable !== false,
  })))
  return Array.from(new Set(resolved.issues.map((issue) => {
    if (issue.code === 'missing-selection') return `Kombo ${issue.comboIndex}, ürün ${issue.itemIndex} seçimini bekliyor.`
    if (issue.code === 'duplicate-item') return `Kombo ${issue.comboIndex}, ürün ${issue.itemIndex} daha önce seçilen bir ürünü tekrarlıyor.`
    if (issue.code === 'missing-item') return `Kombo ${issue.comboIndex}, ürün ${issue.itemIndex} artık menüde bulunmuyor.`
    if (issue.code === 'unavailable-item') {
      const itemName = issue.itemId ? byId.get(issue.itemId)?.name : null
      return `Kombo ${issue.comboIndex}: ${itemName ?? 'Seçili ürün'} pasif olduğu için kullanılamaz.`
    }
    if (issue.code === 'invalid-campaign-price') return `Kombo ${issue.comboIndex} kampanya fiyatı normal toplamdan düşük olmalıdır.`
    return `Kombo ${issue.comboIndex} için ${issue.expectedCount ?? 2} yerine ${issue.resolvedCount ?? 0} geçerli ürün çözüldü.`
  })))
}

export function getThemeComboRibbonIssues(
  theme: GarsonlessTheme,
  menuItems: ComboRibbonMenuItemRef[],
) {
  const instanceIds = new Set<string>()
  for (const block of theme.pageBlocks ?? []) {
    if (block.type !== 'section') continue
    if ((block.sectionId ?? block.id) === 'combo-ribbon') instanceIds.add(block.id)
  }
  for (const block of theme.surfaces?.home.blocks ?? []) {
    if (block.enabled && block.sectionId === 'combo-ribbon') instanceIds.add(block.id)
  }
  return Array.from(instanceIds).flatMap((instanceId) => {
    const settings = theme.sectionSettings?.[instanceId]
      ?? theme.sectionSettings?.['combo-ribbon']
      ?? {}
    if (settings.editorialVersion !== '2') return []
    return getComboRibbonSettingIssues(settings, menuItems).map((issue) => `${instanceId}: ${issue}`)
  })
}
