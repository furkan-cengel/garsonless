'use client'

import type { MenuItemRecommendationRow } from '@garsonless/db/types'
import { useMemo, useState } from 'react'

export function useMenuItemRecommendations(initialRows: MenuItemRecommendationRow[]) {
  const [rows, setRows] = useState(initialRows)
  const idsByItem = useMemo(() => {
    const grouped = new Map<string, string[]>()
    for (const row of rows) {
      const ids = grouped.get(row.sourceItemId) ?? []
      ids[row.position] = row.recommendedItemId
      grouped.set(row.sourceItemId, ids)
    }
    return grouped
  }, [rows])

  function replaceForItem(sourceItemId: string, recommendedItemIds: string[]) {
    setRows((current) => [
      ...current.filter((row) => row.sourceItemId !== sourceItemId),
      ...recommendedItemIds.map((recommendedItemId, position) => ({
        sourceItemId,
        recommendedItemId,
        position,
      })),
    ])
  }

  return { idsByItem, replaceForItem }
}
