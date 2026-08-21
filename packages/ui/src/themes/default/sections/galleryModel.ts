export const GALLERY_EDITORIAL_VERSION = '2'
export const GALLERY_KEYS = ['tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'] as const

export type GalleryKey = typeof GALLERY_KEYS[number]
export type GalleryPreviewMode = 'public' | 'catalog' | 'editor'
export type GalleryLayout = 'mosaic' | 'grid' | 'strip'
export type GalleryMosaicPattern = 'editorial' | 'spotlight' | 'collage'

export type GalleryTile = {
  id: GalleryKey
  imageUrl: string
  label: string
  mockGradient?: string
}

export type ResolvedGallery = {
  isModern: boolean
  order: GalleryKey[]
  tiles: GalleryTile[]
  loadedCount: number
  layout: GalleryLayout
  mosaicPattern: GalleryMosaicPattern
  columns: 2 | 3
  maxItems: number
  rowHeight: number
  gap: number
  padding: number
  radius: number
  imageFit: 'cover' | 'contain'
  imagePosition: 'top' | 'center' | 'bottom'
}

const CATALOG_GRADIENTS = [
  'linear-gradient(135deg, #d8efe3 0%, #f7dfce 100%)',
  'linear-gradient(135deg, #efe5d5 0%, #dcece5 100%)',
  'linear-gradient(135deg, #eadceb 0%, #f8e9d8 100%)',
  'linear-gradient(135deg, #d8e8f2 0%, #e8efd8 100%)',
  'linear-gradient(135deg, #f3dfce 0%, #eee8d9 100%)',
  'linear-gradient(135deg, #dbe9dc 0%, #e4def0 100%)',
] as const

const CATALOG_LABELS = ['İç mekân', 'Kahve', 'Mutfaktan', 'Detaylar', 'Tatlılar', 'Atmosfer'] as const

function integer(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

export function resolveGalleryOrder(value: string | undefined): GalleryKey[] {
  const requested = (value ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key): key is GalleryKey => GALLERY_KEYS.includes(key as GalleryKey))
  return [...new Set([...requested, ...GALLERY_KEYS])]
}

export function resolveGallery(
  config: Record<string, string>,
  previewMode: GalleryPreviewMode = 'public',
): ResolvedGallery {
  const order = resolveGalleryOrder(config.tileOrder)
  const maxItems = integer(config.maxItems, 6, 1, 6)
  const loaded = order
    .map((id) => ({
      id,
      imageUrl: config[`${id}Image`]?.trim() ?? '',
      label: config[`${id}Label`]?.trim() ?? '',
    }))
    .filter((tile) => tile.imageUrl)
  const tiles: GalleryTile[] = loaded.slice(0, maxItems)

  if (tiles.length === 0 && previewMode === 'catalog') {
    for (let index = 0; index < Math.min(maxItems, 5); index += 1) {
      const id = order[index]!
      tiles.push({
        id,
        imageUrl: '',
        label: config[`${id}Label`]?.trim() || CATALOG_LABELS[index] || '',
        mockGradient: CATALOG_GRADIENTS[index]!,
      })
    }
  }

  const layout: GalleryLayout = config.layout === 'grid' || config.layout === 'strip' ? config.layout : 'mosaic'
  const mosaicPattern: GalleryMosaicPattern = config.mosaicPattern === 'spotlight' || config.mosaicPattern === 'collage'
    ? config.mosaicPattern
    : 'editorial'
  const imagePosition = config.imagePosition === 'top' || config.imagePosition === 'bottom'
    ? config.imagePosition
    : 'center'

  return {
    isModern: config.editorialVersion === GALLERY_EDITORIAL_VERSION || previewMode === 'catalog',
    order,
    tiles,
    loadedCount: loaded.length,
    layout,
    mosaicPattern,
    columns: config.columns === '3' ? 3 : 2,
    maxItems,
    rowHeight: integer(config.rowHeight, 104, 72, 180),
    gap: integer(config.gap, 8, 4, 24),
    padding: integer(config.padding, 14, 0, 28),
    radius: integer(config.radius, 16, 0, 28),
    imageFit: config.imageFit === 'contain' ? 'contain' : 'cover',
    imagePosition,
  }
}

export function isSafeGalleryTarget(value: string | undefined) {
  return /^https?:\/\/[^\s]+$/i.test(value?.trim() ?? '')
}
