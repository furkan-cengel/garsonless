'use client'

import dynamic from 'next/dynamic'
import type { TablesBuilderShellProps } from './TablesBuilderShell'
import { TablesRouteSkeleton } from './TablesRouteSkeleton'

const TablesBuilderShell = dynamic(() => import('./TablesBuilderShell'), {
  ssr: false,
  loading: () => <TablesRouteSkeleton variant="qr" />,
})

export default function TablesBuilderClientLoader(props: TablesBuilderShellProps) {
  return <TablesBuilderShell {...props} />
}
