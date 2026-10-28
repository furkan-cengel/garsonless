'use client'

import { useEffect, useRef, useState } from 'react'
import type { PanoBusinessSource } from '@garsonless/application/read-models'
import { fetchPanoBusiness } from '../../lib/actions/pano'
import type { PanoBusinessPeriod } from './pano-business-model'

/**
 * Today and the last 7 days come with every Pano snapshot; 30 days is read on
 * demand. A stale response for an earlier choice never overwrites a newer one.
 */
export function usePanoBusiness(restaurantId: string, snapshotBusiness: PanoBusinessSource | null) {
  const [period, setPeriod] = useState<PanoBusinessPeriod>('today')
  const [month, setMonth] = useState<PanoBusinessSource | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    if (period !== 30) return
    const request = ++requestSequence.current
    setLoading(true)
    setError(null)
    void fetchPanoBusiness(restaurantId, 30).then((result) => {
      if (request !== requestSequence.current) return
      setLoading(false)
      if ('error' in result) setError(result.error)
      else setMonth(result)
    })
  }, [period, restaurantId])

  const source = period === 30 ? month : snapshotBusiness
  return { period, setPeriod, source, loading: period === 30 && loading, error: period === 30 ? error : null }
}
