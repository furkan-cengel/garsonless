import { getSectionDefinitionId } from './section-blocks'
import type { GarsonlessTheme } from './schema'

export interface MenuActionPlacements {
  member: 'header' | 'drawer' | 'hidden'
  bill: 'header' | 'drawer' | 'hidden'
  cart: 'header' | 'drawer' | 'footer' | 'hidden'
  service: 'header' | 'drawer' | 'floating' | 'hidden'
}

export interface MenuActionCapabilities {
  member: boolean
  bill: boolean
  cart: boolean
  service: boolean
}

const HEADER_ACTION_PRIORITY = ['cart', 'service', 'member'] as const

export function resolveMenuActionPlacements(
  theme: GarsonlessTheme,
  capabilities?: Partial<MenuActionCapabilities>,
): MenuActionPlacements {
  const requestBlock = theme.pageBlocks?.find(
    (block) => block.type === 'section' && getSectionDefinitionId(block) === 'request-buttons',
  )
  const member = theme.memberPlacement ?? ((theme.drawerShowMember ?? true) ? 'drawer' : 'header')
  const bill = theme.billPlacement ?? ((theme.drawerShowBill ?? true) ? 'drawer' : theme.headerShowBill ? 'header' : 'hidden')
  const cart = theme.cartPlacement ?? (
    theme.cartHeaderTriggerStyle && theme.cartHeaderTriggerStyle !== 'none'
      ? 'header'
      : theme.cartFooterTriggerStyle && theme.cartFooterTriggerStyle !== 'none'
        ? 'footer'
        : (theme.drawerShowCart ?? true) ? 'drawer' : 'hidden'
  )
  const service = theme.servicePlacement ?? (
    requestBlock?.placement === 'drawer'
      ? 'drawer'
      : requestBlock ? 'floating' : 'hidden'
  )

  const result: MenuActionPlacements = { member, bill, cart, service }
  const headerActions = HEADER_ACTION_PRIORITY.filter(
    (key) => result[key] === 'header' && (capabilities?.[key] ?? true),
  )
  for (const key of headerActions.slice(2)) result[key] = 'drawer'
  return result
}
