'use client'

import DashboardRouteSkeleton from '../layout/DashboardRouteSkeleton'
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type OrderBoardComponent from './OrderBoard'

type Props = ComponentProps<typeof OrderBoardComponent>

const OrderBoard = dynamic(() => import('./OrderBoard'), {
  ssr: false,
  loading: () => <DashboardRouteSkeleton kind="orders" />,
})

export default function OrderBoardBoundary(props: Props) {
  return <OrderBoard {...props} />
}
