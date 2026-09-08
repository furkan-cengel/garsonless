'use client'

import { AnalyticsLoadingFrame } from './AnalyticsLoadingFrame'
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type AnalyticsClientComponent from './AnalyticsClient'

type Props = ComponentProps<typeof AnalyticsClientComponent>

const AnalyticsClient = dynamic(() => import('./AnalyticsClient'), {
  ssr: false,
  loading: AnalyticsLoadingFrame,
})

export default function AnalyticsClientBoundary(props: Props) {
  return <AnalyticsClient {...props} />
}
