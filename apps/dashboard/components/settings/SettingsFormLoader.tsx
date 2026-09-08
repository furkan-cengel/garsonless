'use client'

import dynamic from 'next/dynamic'
import type { SettingsFormProps } from './SettingsForm'
import { SettingsLoadingFrame } from './SettingsLoadingFrame'

const SettingsForm = dynamic(() => import('./SettingsForm'), {
  ssr: false,
  loading: SettingsLoadingFrame,
})

export default function SettingsFormLoader(props: SettingsFormProps) {
  return <SettingsForm {...props} />
}
