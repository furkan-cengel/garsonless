'use client'

import dynamic from 'next/dynamic'
import type { ThemeEditorClientProps } from './theme-editor-client-contract'
import { ThemeEditorLoading } from './ThemeEditorLoading'

const ThemeEditorClient = dynamic(() => import('./ThemeEditorClient'), {
  loading: () => <ThemeEditorLoading />,
  ssr: false,
})

export default function ThemeEditorClientLoader(props: ThemeEditorClientProps) {
  return <ThemeEditorClient {...props} />
}
