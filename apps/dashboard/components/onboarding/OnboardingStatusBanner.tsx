'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Rocket, X } from 'lucide-react'
import type { OnboardingSnapshot } from '@garsonless/application/onboarding'
import { dismissOnboardingChecklistAction } from '../../lib/actions/onboarding'
import styles from './OnboardingStatusBanner.module.css'

export default function OnboardingStatusBanner({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const [hidden, setHidden] = useState(Boolean(snapshot.checklistDismissedAt))
  const requestId = useRef<string | null>(null)
  if (hidden) return null

  if (snapshot.status !== 'completed') {
    return (
      <aside className={styles.banner} aria-label="Eksik kurulum">
        <span className={styles.icon}><Rocket size={17} /></span>
        <div><strong>Menünü yayına hazırlamaya devam et</strong><p>Kurulum ilerlemen kaydedildi; kaldığın adımdan devam edebilirsin.</p></div>
        <Link href="/dashboard/onboarding">Kuruluma dön <ArrowRight size={15} /></Link>
      </aside>
    )
  }

  async function dismiss() {
    if (!snapshot.restaurantId) return
    requestId.current ??= crypto.randomUUID()
    const result = await dismissOnboardingChecklistAction({
      restaurantId: snapshot.restaurantId,
      expectedRevision: snapshot.revision,
      requestId: requestId.current,
    })
    if (!('error' in result)) setHidden(true)
  }

  return (
    <aside className={`${styles.banner} ${styles.completed}`} aria-label="Önerilen kurulum adımları">
      <span className={styles.icon}><CheckCircle2 size={17} /></span>
      <div><strong>Menün hazır — sıradaki işleri tamamla</strong><p>Mağaza bilgileri · Çalışma saatleri · QR kodu · Ekip daveti</p></div>
      <Link href={`/dashboard/${snapshot.restaurantId}/settings`}>Kontrol listesi <ArrowRight size={15} /></Link>
      <button type="button" aria-label="Kurulum önerilerini kapat" onClick={() => void dismiss()}><X size={16} /></button>
    </aside>
  )
}
