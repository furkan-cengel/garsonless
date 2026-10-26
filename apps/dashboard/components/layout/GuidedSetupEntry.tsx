'use client'

import { Compass } from 'lucide-react'
import { I } from '../../lib/ui'
import { openGuidedSetup } from '../onboarding/menu-import-client'
import { useGuidedSetupStatus } from '../onboarding/guided-setup-status'

function progressText(completed: number, total: number) {
  return total > 0 ? `${completed}/${total} tamamlandı` : 'Panoyu adım adım tanı'
}

/* The setup guide lives in a fixed place in the navigation instead of floating over page content. */
export function GuidedSetupRailEntry() {
  const status = useGuidedSetupStatus()
  if (!status.visible) return null
  const remaining = Math.max(0, status.total - status.completed)
  return (
    <div className="rail-item">
      <button
        type="button"
        className="rail-btn rail-setup-btn"
        data-guided-setup-entry
        aria-label={`Kurulum rehberi, ${progressText(status.completed, status.total)}`}
        aria-describedby="rail-tooltip-kurulum"
        aria-haspopup="dialog"
        onClick={openGuidedSetup}
      >
        <Compass size={17} strokeWidth={1.75} aria-hidden="true" />
        {remaining > 0 && <span className="rail-setup-badge" aria-hidden="true">{remaining}</span>}
      </button>
      <span id="rail-tooltip-kurulum" role="tooltip" className="rail-tooltip">Kurulum rehberi · {progressText(status.completed, status.total)}</span>
    </div>
  )
}

export function GuidedSetupMoreRow({ onOpen }: { onOpen: () => void }) {
  const status = useGuidedSetupStatus()
  if (!status.visible) return null
  return (
    <button type="button" className="mobile-more-row" data-guided-setup-entry onClick={() => { onOpen(); openGuidedSetup() }}>
      <span className="mobile-more-row-icon" aria-hidden="true"><Compass size={18} strokeWidth={1.75} /></span>
      <span className="mobile-more-row-copy"><strong>Kurulum rehberi</strong><small>{progressText(status.completed, status.total)}</small></span>
      <I.chevRight size={16} aria-hidden="true" />
    </button>
  )
}
