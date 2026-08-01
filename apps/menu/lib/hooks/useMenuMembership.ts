'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CartItem, MenuItem } from '@garsonless/ui'
import type { MemberBalances } from '@garsonless/db/types'

interface LoyaltyConfig {
  stamp_enabled?: boolean
  points_enabled?: boolean
  points_redeem_rate?: number
  member_discount_pct?: number
  reward_item_id?: string
  welcome_bonus_points?: number
  reward_catalog?: Array<{ itemId?: string; pointCost?: number; tag?: string | null }>
}

interface DiscountPreview {
  subtotal: number
  memberDiscountAmount: number
  memberDiscountPct: number
  memberTierName: string | null
  pointsDiscountAmount: number
  stampDiscountAmount: number
  rewardItemName: string | null
  catalogDiscountAmount: number
  catalogItemName: string | null
  catalogPointsCost: number
  finalTotal: number
  loyaltySuppressedByPromotion?: boolean
}

interface UseMenuMembershipOptions {
  restaurantId: string
  restaurantSettings: unknown
  itemById: Map<string, MenuItem>
  cartItems: CartItem[]
  initialMember: { name: string | null } | null
  initialBalances: MemberBalances | null
}

/** Owns member identity, loyalty redemption intent and server-computed previews. */
export function useMenuMembership({
  restaurantId,
  restaurantSettings,
  itemById,
  cartItems,
  initialMember,
  initialBalances,
}: UseMenuMembershipOptions) {
  const [member, setMember] = useState<{ name: string | null } | null>(initialMember)
  const [memberBalances, setMemberBalances] = useState<MemberBalances | null>(initialBalances)
  const [isMemberOpen, setIsMemberOpen] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [claimStamp, setClaimStamp] = useState(false)
  const [catalogItemId, setCatalogItemId] = useState<string | null>(null)
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null)

  const loyaltyConfig = (restaurantSettings as Record<string, unknown> | null)?.['loyalty'] as LoyaltyConfig | undefined
  const loyaltyEnabled = Boolean(loyaltyConfig?.stamp_enabled || loyaltyConfig?.points_enabled)
  const pointsRate = Math.max(1, loyaltyConfig?.points_redeem_rate ?? 100)
  const memberPct = Math.max(0, Math.min(100, loyaltyConfig?.member_discount_pct ?? 0))
  const rewardItemId = typeof loyaltyConfig?.reward_item_id === 'string' ? loyaltyConfig.reward_item_id : null
  const welcomeBonus = Math.max(0, loyaltyConfig?.welcome_bonus_points ?? 0)
  const rewardCatalog = useMemo(() => (loyaltyConfig?.reward_catalog ?? [])
    .map((reward) => {
      const item = reward.itemId ? itemById.get(reward.itemId) : undefined
      if (!item || typeof reward.pointCost !== 'number' || reward.pointCost <= 0) return null
      return {
        itemId: item.id,
        name: item.name,
        pointCost: reward.pointCost,
        tag: reward.tag ?? null,
      }
    })
    .filter((reward): reward is { itemId: string; name: string; pointCost: number; tag: string | null } => reward !== null),
  [itemById, loyaltyConfig?.reward_catalog])

  const refetchBalances = useCallback(async () => {
    if (!loyaltyEnabled) return
    try {
      const response = await fetch(`/api/loyalty/balances?restaurantId=${restaurantId}`)
      if (!response.ok) return
      const payload = await response.json() as { ok: boolean; balances?: MemberBalances | null }
      if (payload.ok) setMemberBalances(payload.balances ?? null)
    } catch {
      // A later interaction reconciles transient balance-read failures.
    }
  }, [loyaltyEnabled, restaurantId])

  const clearRedemption = useCallback(() => {
    setRedeemPoints(0)
    setClaimStamp(false)
    setCatalogItemId(null)
    setDiscountPreview(null)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      const { createMenuAuthBrowserClient } = await import('../supabase-browser')
      await createMenuAuthBrowserClient().auth.signOut()
    } catch {
      // Clear the local member state even if remote sign-out cannot be reached.
    }
    setMember(null)
    setMemberBalances(null)
    clearRedemption()
    setIsMemberOpen(false)
  }, [clearRedemption])

  const canRedeem = Boolean(member && memberBalances?.pointsEnabled && (memberBalances.points ?? 0) > 0)
  const stampClaimable = Boolean(member && memberBalances?.stampEnabled && memberBalances.stampUnlocked && rewardItemId)
  const canPreview = Boolean(member && (canRedeem || memberPct > 0 || stampClaimable || catalogItemId !== null))

  useEffect(() => {
    if (!canPreview || cartItems.length === 0) {
      setDiscountPreview(null)
      return
    }

    setDiscountPreview(null)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/loyalty/preview-discount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            restaurantId,
            items: cartItems.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              selectedModifiers: item.modifiers,
              removedIngredientIds: item.removedIngredientIds,
              ...(item.productNote ? { productNote: item.productNote } : {}),
              ...(item.recommendationSourceItemId ? { recommendationSourceItemId: item.recommendationSourceItemId } : {}),
              ...(item.combo ? { combo: item.combo } : {}),
              ...(item.promotion ? { promotion: item.promotion } : {}),
            })),
            redeemPoints,
            redeemStampClaim: claimStamp,
            catalogItemId,
          }),
        })
        if (!response.ok) {
          setDiscountPreview(null)
          return
        }
        const payload = await response.json() as { ok: boolean; preview?: DiscountPreview }
        setDiscountPreview(payload.ok && payload.preview ? payload.preview : null)
      } catch {
        if (!controller.signal.aborted) setDiscountPreview(null)
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [canPreview, cartItems, redeemPoints, claimStamp, catalogItemId, restaurantId])

  useEffect(() => {
    if (catalogItemId && !cartItems.some((item) => item.itemId === catalogItemId)) {
      setCatalogItemId(null)
    }
  }, [catalogItemId, cartItems])

  return {
    member,
    setMember,
    memberBalances,
    isMemberOpen,
    setIsMemberOpen,
    loyaltyEnabled,
    pointsRate,
    rewardItemId,
    welcomeBonus,
    rewardCatalog,
    redeemPoints,
    setRedeemPoints,
    claimStamp,
    setClaimStamp,
    catalogItemId,
    setCatalogItemId,
    discountPreview,
    canRedeem,
    stampClaimable,
    refetchBalances,
    clearRedemption,
    handleLogout,
  }
}
