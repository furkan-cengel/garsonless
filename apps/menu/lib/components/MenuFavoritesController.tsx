'use client'

import { useEffect, useRef } from 'react'
import { useMenuFavorites } from '../hooks/useMenuFavorites'

interface Props {
  restaurantId: string
  authenticated: boolean
  availableItemIds: Set<string>
  toggleRequest: { itemId: string; requestId: number } | null
  onChange: (favoriteIds: Set<string>) => void
}

export default function MenuFavoritesController({
  restaurantId,
  authenticated,
  availableItemIds,
  toggleRequest,
  onChange,
}: Props) {
  const { favoriteIds, toggleFavorite } = useMenuFavorites({
    restaurantId,
    authenticated,
    availableItemIds,
  })
  const handledRequestRef = useRef(0)

  useEffect(() => {
    onChange(favoriteIds)
  }, [favoriteIds, onChange])

  useEffect(() => {
    if (!toggleRequest || handledRequestRef.current === toggleRequest.requestId) return
    handledRequestRef.current = toggleRequest.requestId
    void toggleFavorite(toggleRequest.itemId)
  }, [toggleFavorite, toggleRequest])

  return null
}
