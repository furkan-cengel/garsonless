'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { fetchPanoChart } from '../../lib/actions/pano'
import { createDayPanoChart, type PanoChartData, type PanoChartRange } from '../../lib/pano-chart-model'
import type { HourlySale } from '../../lib/queries/pano'

export type PanoSalesChartController = {
  data: PanoChartData
  error: string
  isPending: boolean
  onSelectRange: (range: PanoChartRange, force?: boolean) => void
}

/**
 * Owns range selection, server refresh and stale-response reconciliation for
 * the Pano sales chart. The SVG/tooltip surface deliberately stays in the view.
 */
export function usePanoSalesChart({
  restaurantId,
  initialHourly,
  timezone,
  now,
}: {
  restaurantId: string
  initialHourly: HourlySale[]
  timezone: string
  now: Date
}): PanoSalesChartController {
  const [data, setData] = useState<PanoChartData>(() => createDayPanoChart(initialHourly, timezone, now))
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const requestSequence = useRef(0)

  useEffect(() => {
    if (data.range !== 'day') return
    setData(createDayPanoChart(initialHourly, timezone, now))
  }, [data.range, initialHourly, now, timezone])

  const onSelectRange = useCallback((range: PanoChartRange, force = false) => {
    if ((!force && range === data.range) || isPending) return

    const requestId = ++requestSequence.current
    setError('')
    startTransition(async () => {
      try {
        const result = await fetchPanoChart(restaurantId, range)
        if (requestId !== requestSequence.current) return
        if ('error' in result) {
          setError('Veri alınamadı')
          return
        }
        setData(result)
      } catch {
        if (requestId !== requestSequence.current) return
        setError('Veri alınamadı')
      }
    })
  }, [data.range, isPending, restaurantId])

  return { data, error, isPending, onSelectRange }
}
