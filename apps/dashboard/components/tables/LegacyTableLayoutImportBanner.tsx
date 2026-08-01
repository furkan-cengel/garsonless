'use client'

import { InlineSpinner } from '@garsonless/ui'
import { AppIcons } from '@garsonless/ui/icons'
import type { LegacyTableLayoutCandidate } from './legacy-table-layout-model'

export function LegacyTableLayoutImportBanner({
  candidate,
  importing,
  onImport,
  onDismiss,
}: {
  candidate: LegacyTableLayoutCandidate
  importing: boolean
  onImport: () => void
  onDismiss: () => void
}) {
  return (
    <aside className="tb-floor__legacy-import" aria-labelledby="legacy-layout-title">
      <span className="tb-floor__legacy-icon" aria-hidden="true"><AppIcons.history size={16} /></span>
      <div>
        <strong id="legacy-layout-title">Bu tarayıcıda eski bir salon planı bulundu</strong>
        <span>
          {candidate.entries.length} masa güvenli biçimde eşleşti.
          {candidate.skippedCount > 0 && ` ${candidate.skippedCount} geçersiz veya silinmiş kayıt içe alınmayacak.`}
        </span>
      </div>
      <button type="button" disabled={importing} onClick={onDismiss}>Şimdi değil</button>
      <button type="button" className="is-primary" disabled={importing} onClick={onImport}>
        {importing ? <><InlineSpinner size={12} color="var(--on-action)" />İçe aktarılıyor…</> : 'İçe aktar'}
      </button>
    </aside>
  )
}
