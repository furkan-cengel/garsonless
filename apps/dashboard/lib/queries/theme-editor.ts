import { cache } from 'react'
import { readThemeMenuReferences } from '@garsonless/application/themes'
import {
  createThemeMenuReferenceReadModelPort,
} from '@garsonless/db/server'
import { getDashboardFeatureContext } from './context'

const themeMenuReadModel = createThemeMenuReferenceReadModelPort()

export const getThemeEditorMenuRefs = cache(async function getThemeEditorMenuRefs(restaurantId: string) {
  const context = await getDashboardFeatureContext(restaurantId)
  if (!context) return { categories: [], items: [] }
  const result = await readThemeMenuReferences(context, restaurantId, themeMenuReadModel)
  return result.ok ? result.value : { categories: [], items: [] }
})
