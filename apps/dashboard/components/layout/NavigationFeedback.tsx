'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  NavigationFeedbackController,
  type NavigationFeedbackSnapshot,
} from './navigation-feedback-model'
import styles from './NavigationFeedback.module.css'

export function useNavigationFeedback() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const controllerRef = useRef<NavigationFeedbackController | null>(null)
  if (!controllerRef.current) controllerRef.current = new NavigationFeedbackController()
  const controller = controllerRef.current
  const [snapshot, setSnapshot] = useState<NavigationFeedbackSnapshot>(controller.getSnapshot)
  const routeKey = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  useEffect(() => controller.subscribe(setSnapshot), [controller])
  useEffect(() => {
    controller.completeForHref(`${window.location.origin}${routeKey}`)
  }, [controller, routeKey])
  useEffect(() => () => controller.dispose(), [controller])

  const beginNavigation = useCallback((targetHref: string) => (
    controller.begin(targetHref, window.location.href)
  ), [controller])
  const cancelNavigation = useCallback((operationId?: string) => {
    controller.cancel(operationId)
  }, [controller])
  const retryNavigation = useCallback(() => {
    const retry = controller.retry(window.location.href)
    if (retry) router.replace(retry.targetHref)
  }, [controller, router])

  return { snapshot, beginNavigation, cancelNavigation, retryNavigation }
}

export default function NavigationFeedback({
  snapshot,
  onRetry,
  onDismiss,
}: {
  snapshot: NavigationFeedbackSnapshot
  onRetry: () => void
  onDismiss: () => void
}) {
  if (snapshot.phase === 'idle' || snapshot.phase === 'delay') return null

  return (
    <>
      <div className={styles.bar} aria-hidden="true" />
      {snapshot.phase === 'stalled' && (
        <div className={styles.recovery} role="alert" aria-live="assertive">
          <span className={styles.message}>Yükleme beklenenden uzun sürüyor.</span>
          <span className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={onRetry}>Tekrar dene</button>
            <button type="button" className={styles.button} onClick={onDismiss}>Kapat</button>
          </span>
        </div>
      )}
    </>
  )
}
