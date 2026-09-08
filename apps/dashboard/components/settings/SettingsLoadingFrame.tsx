import { Card, CardContent, CardFooter, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import styles from './SettingsForm.module.css'

function SectionPlaceholder() {
  return (
    <Card size="sm" className="gap-0 py-0" aria-hidden="true">
      <CardHeader className="grid-cols-1 border-b py-3">
        <Skeleton className="h-5 w-32 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.loadingFormRow}>
            <div className="grid min-w-0 gap-2">
              <Skeleton className="h-4 w-24 max-w-full" />
              <Skeleton className="h-3 w-36 max-w-full" />
            </div>
            <Skeleton className={styles.loadingControl} />
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end"><Skeleton className={styles.loadingSave} /></CardFooter>
    </Card>
  )
}

export function SettingsSectionLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Ayar bölümü yükleniyor">
      <SectionPlaceholder />
    </div>
  )
}

/** Shared by the route boundary and the lazy form; both keep the same geometry. */
export function SettingsLoadingFrame() {
  return (
    <div className={styles.root} data-settings-root role="status" aria-live="polite" aria-busy="true" aria-label="Ayarlar yükleniyor">
      <div className={styles.loadingTopbar} aria-hidden="true">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-7 shrink-0" />
          <Skeleton className="h-5 w-20 max-w-full" />
        </div>
        <Skeleton className="size-8 shrink-0" />
      </div>
      <div className={styles.body} aria-hidden="true">
        <div className={styles.nav}>
          <div className={styles.navHeader}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-1 h-4 w-36" />
          </div>
          <div className={styles.navScroller}>
            {Array.from({ length: 3 }, (_, group) => (
              <div className={styles.navGroup} key={group}>
                <div className={styles.navGroupTitle}><Skeleton className="h-3 w-20" /></div>
                {Array.from({ length: 4 }, (_, index) => (
                  <div className={styles.navRow} key={index}>
                    <Skeleton className="size-4 shrink-0" />
                    <div className={styles.navRowCopy}>
                      <Skeleton className="h-4 w-20 max-w-full" />
                      <Skeleton className={`${styles.navRowDescription} h-3 w-32 max-w-full`} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.contentArea} data-settings-content>
          <div className={styles.contentInner} style={{ maxWidth: 760 }}>
            <div className={styles.loadingHeading}>
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-9 w-48 max-w-full" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </div>
            <SectionPlaceholder />
          </div>
        </div>
      </div>
    </div>
  )
}
