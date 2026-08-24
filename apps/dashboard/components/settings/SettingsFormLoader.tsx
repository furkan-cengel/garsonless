'use client'

import dynamic from 'next/dynamic'
import type { SettingsFormProps } from './SettingsForm'
import styles from './SettingsForm.module.css'

const SettingsForm = dynamic(() => import('./SettingsForm'), {
  ssr: false,
  loading: SettingsShellLoading,
})

function SettingsShellLoading() {
  return (
    <div className={styles.root} data-settings-root aria-busy="true">
      <div className="flex min-h-14 items-center border-b px-4 sm:px-6">
        <div>
          <div className="text-base font-semibold">Ayarlar</div>
          <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
            Ayarlar güvenli biçimde yükleniyor…
          </div>
        </div>
      </div>
      <div className={styles.body}>
        <div className={`${styles.nav} animate-pulse`} aria-hidden="true">
          <div className="m-4 h-6 w-24 rounded bg-muted" />
          <div className="mx-4 mt-8 grid gap-3">
            {Array.from({ length: 7 }, (_, index) => <div key={index} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
        <div className={`${styles.contentArea} animate-pulse`} aria-hidden="true">
          <div className={`${styles.contentInner} grid gap-4`}>
            <div className="h-7 w-48 rounded bg-muted" />
            <div className="h-4 w-72 max-w-full rounded bg-muted" />
            <div className="mt-4 h-64 rounded-xl border bg-card" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsFormLoader(props: SettingsFormProps) {
  return <SettingsForm {...props} />
}
