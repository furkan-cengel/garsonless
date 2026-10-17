'use client'

import { useEffect, useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { useThemeDraftRecovery } from './use-theme-draft-recovery'

function describe(value: unknown): string {
  if (value === undefined) return 'Kaldırıldı'
  if (typeof value === 'boolean') return value ? 'Açık' : 'Kapalı'
  if (typeof value === 'string') return value || 'Boş'
  return JSON.stringify(value)
}

export function ThemeDraftRecoveryPanel({ recovery }: { recovery: ReturnType<typeof useThemeDraftRecovery> }) {
  const heading = useRef<HTMLDivElement>(null)
  const isPending = Boolean(recovery.pending)
  useEffect(() => { if (isPending) heading.current?.focus() }, [isPending])
  if (!recovery.pending) return null
  return (
    <div className="max-h-[45dvh] shrink-0 overflow-auto p-2">
      <Alert>
        <AlertTitle ref={heading} tabIndex={-1}>Taslak başka bir yerde güncellendi</AlertTitle>
        <AlertDescription>
          <p>Kaydetmeye veya yayınlamaya çalıştığın sürüm değişmiş. Devam etmek için değişikliklerini güncel taslakla karşılaştır.</p>
          {recovery.error && <p role="alert" className="text-destructive">{recovery.error}</p>}
          {recovery.remote && <p>{recovery.conflicts.length > 0
            ? `${recovery.conflicts.length} alanda farklı değişiklikler var. Seçimin yalnızca bu alanlara uygulanır; diğer değişiklikler birlikte korunur.`
            : 'Çakışan alan yok. Yerel ve güncel değişiklikler birlikte geri yüklenebilir.'}</p>}
          {recovery.conflicts.length > 0 && <ul className="my-2 flex flex-col gap-2" aria-label="Çakışan tema alanları">
            {recovery.conflicts.map((conflict) => <li key={conflict.path} className="break-words rounded border p-2">
              <strong>{conflict.path}</strong>
              <div>Yerel: {describe(conflict.local)}</div>
              <div>Güncel: {describe(conflict.remote)}</div>
            </li>)}
          </ul>}
          <div className="flex flex-wrap gap-2">
            {recovery.pending && !recovery.remote && <Button size="sm" className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal" onClick={() => void recovery.compare()} disabled={recovery.busy}>
              {recovery.busy ? 'Karşılaştırılıyor…' : 'Güncel taslakla karşılaştır'}
            </Button>}
            {recovery.remote && <>
              <Button size="sm" className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal" onClick={() => recovery.apply('local')}>{recovery.conflicts.length ? 'Çakışanlarda yereli tut' : 'Değişiklikleri geri yükle'}</Button>
              {recovery.conflicts.length > 0 && <Button size="sm" className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal" variant="outline" onClick={() => recovery.apply('remote')}>Çakışanlarda günceli tut</Button>}
              <Button size="sm" className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal" variant="outline" onClick={() => recovery.apply('discard')}>Yerel çalışmayı bırak, günceli aç</Button>
            </>}
            <Button size="sm" className="h-auto min-h-8 min-w-0 max-w-full whitespace-normal" variant="outline" onClick={recovery.download}>Yerel kopyayı indir</Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
