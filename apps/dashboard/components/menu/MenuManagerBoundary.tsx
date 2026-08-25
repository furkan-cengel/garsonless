'use client'

import DashboardRouteSkeleton from '../layout/DashboardRouteSkeleton'
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type MenuManagerComponent from './MenuManager'

type Props = ComponentProps<typeof MenuManagerComponent>

const MenuManager = dynamic(() => import('./MenuManager'), {
  ssr: false,
  loading: () => <DashboardRouteSkeleton kind="menu" />,
})

export default function MenuManagerBoundary(props: Props) {
  return <MenuManager {...props} />
}
