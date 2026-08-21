import { MenuCategoryIcon, getMenuCategoryIconKey } from '@garsonless/ui/menu'

import { I } from '../../lib/ui'

export function MenuCategoryGlyph({ name, size = 15 }: { name: string; size?: number }) {
  const icon = getMenuCategoryIconKey(name)

  return icon
    ? <MenuCategoryIcon icon={icon} width={size} height={size} />
    : <I.menuDish size={size} />
}
