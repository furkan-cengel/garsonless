import React from 'react'
import type { CSSProperties, HTMLAttributes } from 'react'

const CHEF_SECTION_ICON_SPRITE = '/brand/chef-section-icons.svg'

export const CHEF_SECTION_ICON_OPTIONS = [
  { value: 'catal-kasik', label: 'Çatal kaşık' },
  { value: 'sef-sapkasi', label: 'Şef şapkası' },
  { value: 'sef-bicagi', label: 'Şef bıçağı' },
  { value: 'servis-kapagi', label: 'Servis kapağı' },
  { value: 'siparis-zili', label: 'Sipariş zili' },
  { value: 'tabaklama', label: 'Tabaklama' },
  { value: 'ates', label: 'Ateş' },
  { value: 'tava', label: 'Tava' },
  { value: 'tencere', label: 'Tencere' },
  { value: 'firin', label: 'Fırın' },
  { value: 'cirpici', label: 'Çırpıcı' },
  { value: 'oklava', label: 'Oklava' },
  { value: 'kesme-tahtasi', label: 'Kesme tahtası' },
  { value: 'malzemeler', label: 'Malzemeler' },
  { value: 'tarif', label: 'Tarif' },
  { value: 'zamanlayici', label: 'Zamanlayıcı' },
] as const

export type ChefSectionIconName = (typeof CHEF_SECTION_ICON_OPTIONS)[number]['value']

const ICON_GRID: Record<ChefSectionIconName, readonly [column: number, row: number]> = {
  'catal-kasik': [0, 0],
  'sef-sapkasi': [1, 0],
  'sef-bicagi': [2, 0],
  'servis-kapagi': [3, 0],
  'siparis-zili': [0, 1],
  tabaklama: [1, 1],
  ates: [2, 1],
  tava: [3, 1],
  tencere: [0, 2],
  firin: [1, 2],
  cirpici: [2, 2],
  oklava: [3, 2],
  'kesme-tahtasi': [0, 3],
  malzemeler: [1, 3],
  tarif: [2, 3],
  zamanlayici: [3, 3],
}

const SPRITE_POSITION = ['0%', '33.333333%', '66.666667%', '100%'] as const

type ChefSectionIconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  name: ChefSectionIconName
  width?: number | string
  height?: number | string
}

export function isChefSectionIconName(value: string): value is ChefSectionIconName {
  return CHEF_SECTION_ICON_OPTIONS.some((option) => option.value === value)
}

export function ChefSectionIcon({ name, width = 24, height = 24, className, style, ...props }: ChefSectionIconProps) {
  const [column, row] = ICON_GRID[name]
  const tileStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url("${CHEF_SECTION_ICON_SPRITE}")`,
    maskImage: `url("${CHEF_SECTION_ICON_SPRITE}")`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: '400% 400%',
    maskSize: '400% 400%',
    WebkitMaskPosition: `${SPRITE_POSITION[column]} ${SPRITE_POSITION[row]}`,
    maskPosition: `${SPRITE_POSITION[column]} ${SPRITE_POSITION[row]}`,
    transform: 'scale(1.65)',
    transformOrigin: 'center',
  } satisfies CSSProperties

  return (
    <span
      {...props}
      aria-hidden="true"
      className={className}
      data-chef-section-icon={name}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        flex: '0 0 auto',
        overflow: 'hidden',
        color: 'inherit',
        ...style,
      }}
    >
      <span aria-hidden="true" style={tileStyle} />
    </span>
  )
}
