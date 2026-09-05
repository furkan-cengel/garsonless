import { cache } from 'react'
import { readThemeMenuReferences } from '@garsonless/application/themes'
import {
  createThemeMenuReferenceReadModelPort,
} from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'
import { requireThemeMenuReferences } from '../theme-menu-references'

const themeMenuReadModel = createThemeMenuReferenceReadModelPort()

export const getThemeEditorMenuRefs = cache(async function getThemeEditorMenuRefs(restaurantId: string) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) throw new Error('Theme menu context unavailable')
  const result = await readThemeMenuReferences(context, restaurantId, themeMenuReadModel)
  return requireThemeMenuReferences(result)
})
