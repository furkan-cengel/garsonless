import { cache } from 'react'
import { readPublicMenuRevision } from '@garsonless/application/public-menu-cache'
import { createPublicMenuRevisionPort } from '@garsonless/db/server'

/** Request-deduplicated, intentionally uncached revision read. */
export const getPublicMenuRevision = cache(async (restaurantId: string) => (
  readPublicMenuRevision(restaurantId, createPublicMenuRevisionPort())
))
