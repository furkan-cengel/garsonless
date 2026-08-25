'use client'

import DashboardRouteSkeleton from '../layout/DashboardRouteSkeleton'
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type AnalyticsClientComponent from './AnalyticsClient'

type Props = ComponentProps<typeof AnalyticsClientComponent>

const AnalyticsClient = dynamic(() => import('./AnalyticsClient'), {
  ssr: false,
  loading: () => <DashboardRouteSkeleton kind="analytics" />,
})

export default function AnalyticsClientBoundary(props: Props) {
  return <AnalyticsClient {...props} />
}
