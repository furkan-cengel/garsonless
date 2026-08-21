import { ChefSectionIcon } from '@garsonless/ui/themes/default'
import { I } from '../../lib/ui'

export type ThemeSectionCatalogIconName = keyof typeof I | 'chef-hat'

interface ThemeSectionCatalogIconProps {
  icon: ThemeSectionCatalogIconName
  size?: number
}

export function ThemeSectionCatalogIcon({ icon, size = 20 }: ThemeSectionCatalogIconProps) {
  if (icon === 'chef-hat') {
    return <ChefSectionIcon name="sef-sapkasi" width={size} height={size} />
  }

  const Icon = I[icon]
  return <Icon size={size} />
}
