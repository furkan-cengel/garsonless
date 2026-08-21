import type { GarsonlessTheme } from '@garsonless/design-engine'

export function resolveHomeOpenGraphImage(theme: GarsonlessTheme | null | undefined) {
  const home = theme?.surfaces?.home
  const modernPoster = home?.blocks
    ?.filter((block) => block.enabled && block.sectionId === 'storefront-video-hero')
    .map((block) => theme?.sectionSettings?.[block.id]?.posterUrl?.trim())
    .find(Boolean)
  if (modernPoster) return modernPoster
  const legacyPoster = home?.sections.find((section) => section.enabled && (section.posterUrl || section.imageUrl))
  return legacyPoster?.posterUrl || legacyPoster?.imageUrl || null
}
