'use client'

import type { BillableFeature } from '@garsonless/domain/entitlements'
import { Button } from '../ui/button'
import { I } from '../../lib/ui'
import PlanLockCard from '../plan-lock/PlanLockCard'
import { getPlanLockPresentation } from '../plan-lock/presentation'
import styles from '../PlanLockedPanel.module.css'

export default function SettingsPlanLock({ feature, label, requiredPlanLabel, isOwner, onBilling }: {
  feature: BillableFeature
  label: string
  requiredPlanLabel: string | null
  isOwner: boolean
  onBilling: () => void
}) {
  return <div data-settings-plan-lock role="region" aria-label={`${label} paket kilidi`}>
    <PlanLockCard
      title={`${label} ${requiredPlanLabel ?? 'üst paket'} ve üzeri paketlerle açılır`}
      description="Bu bölümdeki veriler korunur. Gerekli paket etkinleştiğinde kaldığınız yerden devam edebilirsiniz."
      benefits={getPlanLockPresentation(feature).benefits}>
      {isOwner ? <Button type="button" className={styles.primaryAction} onClick={onBilling}>Planları incele <I.chevRight size={14} /></Button> : <p className="m-0 text-sm font-medium">Paketi yükseltmek için işletme sahibinizle iletişime geçin.</p>}
    </PlanLockCard>
  </div>
}
