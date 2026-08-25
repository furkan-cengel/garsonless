'use client'

import DashboardRouteSkeleton from '../layout/DashboardRouteSkeleton'
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type CustomersClientComponent from './CustomersClient'

type Props = ComponentProps<typeof CustomersClientComponent>

const CustomersClient = dynamic(() => import('./CustomersClient'), {
  ssr: false,
  loading: () => <DashboardRouteSkeleton kind="customers" />,
})

export default function CustomersClientBoundary(props: Props) {
  return <CustomersClient {...props} />
}
