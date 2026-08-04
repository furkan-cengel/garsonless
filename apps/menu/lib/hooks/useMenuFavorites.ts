'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiResult } from '../customer-auth-contract'
import type { CustomerFavoritesView } from '../customer-account-contract'
import {
  clearGuestFavoriteIds,
  readGuestFavoriteIds,
  writeGuestFavoriteIds,
} from '../menu-continuity-client'

export function useMenuFavorites(input: {
  restaurantId: string
  authenticated: boolean
  availableItemIds: Set<string>
}) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const guestIds = readGuestFavoriteIds(input.restaurantId).filter((itemId) => input.availableItemIds.has(itemId))
      if (!input.authenticated) {
        if (!cancelled) setFavoriteIds(new Set(guestIds))
        return
      }
      setSyncing(true)
      setError(false)
      try {
        let response: Response
        if (guestIds.length > 0) {
          response = await fetch('/api/account/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId: input.restaurantId, menuItemIds: guestIds }),
          })
        } else {
          response = await fetch(`/api/account/favorites?restaurantId=${encodeURIComponent(input.restaurantId)}`, { cache: 'no-store' })
        }
        const result = await response.json() as ApiResult<CustomerFavoritesView>
        if (!response.ok || !result.ok) throw new Error('favorites_sync_failed')
        if (!cancelled) {
          setFavoriteIds(new Set(result.data.items.map((favorite) => favorite.item.id)))
          if (guestIds.length > 0) clearGuestFavoriteIds(input.restaurantId)
        }
      } catch {
        if (!cancelled) {
          setFavoriteIds(new Set(guestIds))
          setError(true)
        }
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }
    void sync()
    return () => { cancelled = true }
  }, [input.authenticated, input.availableItemIds, input.restaurantId])

  const toggleFavorite = useCallback(async (itemId: string) => {
    if (!input.availableItemIds.has(itemId)) return
    const wasFavorite = favoriteIds.has(itemId)
    const next = new Set(favoriteIds)
    if (wasFavorite) next.delete(itemId)
    else next.add(itemId)
    setFavoriteIds(next)
    setError(false)

    if (!input.authenticated) {
      writeGuestFavoriteIds(input.restaurantId, next)
      return
    }
    try {
      const response = await fetch('/api/account/favorites', {
        method: wasFavorite ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wasFavorite
          ? { restaurantId: input.restaurantId, menuItemId: itemId }
          : { restaurantId: input.restaurantId, menuItemIds: [itemId] }),
      })
      const result = await response.json() as ApiResult<CustomerFavoritesView>
      if (!response.ok || !result.ok) throw new Error('favorite_write_failed')
      setFavoriteIds(new Set(result.data.items.map((favorite) => favorite.item.id)))
    } catch {
      setFavoriteIds(favoriteIds)
      setError(true)
    }
  }, [favoriteIds, input.authenticated, input.availableItemIds, input.restaurantId])

  return useMemo(() => ({ favoriteIds, toggleFavorite, syncing, error }), [error, favoriteIds, syncing, toggleFavorite])
}
