'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicCouponChoice } from '@garsonless/domain/coupons'
import { getActiveCouponChoices } from '../../lib/actions/coupons'

export function useThemeEditorCoupons(
  restaurantId: string,
  initialCoupons: PublicCouponChoice[],
): PublicCouponChoice[] {
  const [coupons, setCoupons] = useState<PublicCouponChoice[]>(initialCoupons)
  const reload = useCallback(async () => {
    const result = await getActiveCouponChoices(restaurantId)
    if ('coupons' in result) setCoupons(result.coupons)
  }, [restaurantId])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])
  return coupons
}
