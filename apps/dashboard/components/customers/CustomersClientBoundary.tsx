'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type CustomersClientComponent from './CustomersClient'
import DashboardRouteSkeleton from '../layout/DashboardRouteSkeleton'

// Keep server-rendered customer HTML while retaining a separate client chunk.
const CustomersClient = dynamic(() => import('./CustomersClient'), {
  loading: () => <DashboardRouteSkeleton kind="customers" />,
})

export default function CustomersClientBoundary(props: ComponentProps<typeof CustomersClientComponent>) {
  return <CustomersClient {...props} />
}
