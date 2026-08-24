'use client'

import dynamic from 'next/dynamic'
import type { TablesOperationsShellProps } from './tables-operations-ui-types'
import { TablesRouteSkeleton } from './TablesRouteSkeleton'

const TablesOperationsShell = dynamic(() => import('./TablesOperationsShell'), {
  ssr: false,
  loading: () => <TablesRouteSkeleton variant="operations" />,
})

export default function TablesOperationsClientLoader(props: TablesOperationsShellProps) {
  return <TablesOperationsShell {...props} />
}
