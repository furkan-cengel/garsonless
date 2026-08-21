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

export type FooterCartTriggerStyle = 'none' | 'bar' | 'fab' | 'thumbs' | 'pill'

export interface FooterCartClearance {
  style: FooterCartTriggerStyle
  pixels: number
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

/**
 * Keep footer clearance and the fixed cart trigger on one deterministic metric
 * contract. Safe-area is applied separately by CSS.
 */
export function resolveFooterCartClearance(theme: GarsonlessTheme): FooterCartClearance {
  if (resolveMenuActionPlacements(theme).cart !== 'footer') return { style: 'none', pixels: 0 }
  const configured = theme.cartFooterTriggerStyle
    ?? (theme.cartStyle === 'banner' ? 'bar' : theme.cartStyle === 'fab' ? 'fab' : 'pill')
  const style: FooterCartTriggerStyle = configured === 'tabbar' ? 'pill' : configured
  if (style === 'none') return { style, pixels: 0 }
  if (style === 'fab') return { style, pixels: 60 + 24 + 12 }
  if (style === 'thumbs') return { style, pixels: 58 + 18 + 12 }
  if (style === 'bar') return { style, pixels: 58 + 12 + 14 + 12 }
  return { style, pixels: (theme.cartPillPosition === 'edge' ? 72 : 66 + 20) + 12 }
}
