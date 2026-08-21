'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CartItem, MenuItem } from '@garsonless/ui/menu'
import type { MemberBalances } from '@garsonless/db/types'
import type { MembershipDiscountPreview } from '../menu-membership-client'

interface LoyaltyConfig {
  stamp_enabled?: boolean
  points_enabled?: boolean
  points_redeem_rate?: number
  member_discount_pct?: number
  reward_item_id?: string
  welcome_bonus_points?: number
  reward_catalog?: Array<{ itemId?: string; pointCost?: number; tag?: string | null }>
}

interface UseMenuMembershipOptions {
  restaurantId: string
  restaurantSettings: unknown
  itemById: Map<string, MenuItem>
  cartItems: CartItem[]
  initialMember: { name: string | null } | null
  initialBalances: MemberBalances | null
  initialOpen?: boolean
}

/** Owns member identity, loyalty redemption intent and server-computed previews. */
export function useMenuMembership({
  restaurantId,
  restaurantSettings,
  itemById,
  cartItems,
  initialMember,
  initialBalances,
  initialOpen = false,
}: UseMenuMembershipOptions) {
  const [member, setMember] = useState<{ name: string | null } | null>(initialMember)
  const [memberBalances, setMemberBalances] = useState<MemberBalances | null>(initialBalances)
  const [isMemberOpen, setIsMemberOpen] = useState(initialOpen)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [claimStamp, setClaimStamp] = useState(false)
  const [catalogItemId, setCatalogItemId] = useState<string | null>(null)
  const [discountPreview, setDiscountPreview] = useState<MembershipDiscountPreview | null>(null)
  const [couponDraft, setCouponDraft] = useState('')
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponPending, setCouponPending] = useState(false)

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
      const response = await fetch(`/api/loyalty/balances?restaurantId=${restaurantId}`, { cache: 'no-store' })
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
    setCouponCode(null)
    setCouponDraft('')
    setCouponError(null)
  }, [])

  const handleLogout = useCallback(async (scope: 'device' | 'all' = 'device') => {
    const { logoutCustomerDevice } = await import('../menu-membership-client')
    if (!await logoutCustomerDevice(scope)) return false
    setMember(null)
    setMemberBalances(null)
    clearRedemption()
    return true
  }, [clearRedemption])

  const canRedeem = Boolean(member && memberBalances?.pointsEnabled && (memberBalances.points ?? 0) > 0)
  const stampClaimable = Boolean(member && memberBalances?.stampEnabled && memberBalances.stampUnlocked && rewardItemId)
  const canPreview = Boolean(couponCode || (member && (canRedeem || memberPct > 0 || stampClaimable || catalogItemId !== null)))

  useEffect(() => {
    if (!canPreview || cartItems.length === 0) {
      setDiscountPreview(null)
      return
    }

    setDiscountPreview(null)
    setCouponPending(Boolean(couponCode))
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { fetchCheckoutDiscountPreview } = await import('../menu-membership-client')
        const result = await fetchCheckoutDiscountPreview({
          restaurantId,
          items: cartItems,
          redeemPoints,
          redeemStampClaim: claimStamp,
          catalogItemId,
          couponCode,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setCouponPending(false)
          if (!result.ok) {
            setDiscountPreview(null)
            if (couponCode) setCouponError(result.error)
            return
          }
          setDiscountPreview(result.preview)
          setCouponError(null)
          if (result.preview.couponStackingPolicy === 'exclusive') {
            setRedeemPoints(0); setClaimStamp(false); setCatalogItemId(null)
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setDiscountPreview(null)
          setCouponPending(false)
          if (couponCode) setCouponError('Kupon şu anda doğrulanamadı. Tekrar deneyin.')
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [canPreview, cartItems, redeemPoints, claimStamp, catalogItemId, restaurantId, couponCode])

  const applyCoupon = useCallback(() => {
    const normalized = couponDraft.trim().toUpperCase()
    if (!normalized) return
    setCouponError(null)
    setCouponPending(true)
    setCouponCode(normalized)
  }, [couponDraft])
  const removeCoupon = useCallback(() => {
    setCouponCode(null); setCouponDraft(''); setCouponError(null); setCouponPending(false)
  }, [])
  const rejectCoupon = useCallback((message: string) => {
    setCouponError(message)
    setCouponPending(false)
    setDiscountPreview(null)
  }, [])

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
    couponDraft,
    setCouponDraft,
    couponCode,
    couponError,
    couponPending,
    applyCoupon,
    removeCoupon,
    rejectCoupon,
    canRedeem,
    stampClaimable,
    refetchBalances,
    clearRedemption,
    handleLogout,
  }
}
