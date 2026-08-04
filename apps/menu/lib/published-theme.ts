import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { readPublishedTheme } from '@garsonless/application/themes'
import { createThemeApplicationPort } from '@garsonless/db/server'

/**
 * The layout, metadata and page all need the same published theme. React cache
 * deduplicates within a request; the tagged Next cache avoids repeating the DB
 * read across requests and is invalidated by the dashboard publish action.
 */
export const getPublishedTheme = cache(async function getPublishedTheme(
  restaurantId: string,
  restaurantSlug: string,
) {
  return unstable_cache(
    () => readPublishedTheme({ restaurantId }, createThemeApplicationPort()),
    ['public-menu-theme-v1', restaurantId],
    {
      revalidate: 60,
      tags: [`theme:${restaurantId}`, `public-menu:${restaurantSlug}`],
    },
  )()
})

/** Preview overrides are editor-scoped and must never enter the public cache. */
export const getPreviewTheme = cache(async function getPreviewTheme(
  restaurantId: string,
  templateOverride: string | null,
) {
  return readPublishedTheme(
    { restaurantId, templateOverride },
    createThemeApplicationPort(),
  )
})
