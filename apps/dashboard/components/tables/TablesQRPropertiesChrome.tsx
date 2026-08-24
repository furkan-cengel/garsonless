'use client'

import { useEffect, useRef } from 'react'
import { Frame, ImageIcon, Link2, Paintbrush, QrCode, RotateCcw } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { QRHealth, SaveState } from './tables-builder-types'
import { QR_PROPERTY_TABS, type QRPropertiesTab } from './use-tables-qr-properties-model'

const TAB_ICONS = {
  qr: QrCode,
  paint: Paintbrush,
  image: ImageIcon,
  frame: Frame,
  link2: Link2,
}

export function TablesQRPropertiesHeader({
  status,
  saveState,
  saveError,
  health,
  onRetry,
}: {
  status: { label: string; tone: 'neutral' | 'positive'; dot: string }
  saveState: SaveState
  saveError: string | null
  health: QRHealth
  onRetry: () => void
}) {
  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">QR Stüdyosu</p>
          <p className="text-xs text-muted-foreground">Tüm masalara uygulanır</p>
        </div>
        <Badge variant={status.tone === 'positive' ? 'positive' : 'secondary'}>{status.label}</Badge>
      </div>
      {(saveState === 'blocked' || health.state === 'invalid') && (
        <Alert variant="destructive" aria-live="assertive" className="mt-3">
          <AlertTitle>Kaydetme engellendi</AlertTitle>
          <AlertDescription>{saveError ?? health.message}</AlertDescription>
        </Alert>
      )}
      {(saveState === 'error' || saveState === 'conflict') && (
        <Alert variant={saveState === 'error' ? 'destructive' : 'default'} role={saveState === 'error' ? 'alert' : 'status'} aria-live="polite" className="mt-3">
          <AlertTitle>{saveState === 'conflict' ? 'Stil güncellendi' : 'Değişiklikler kaydedilemedi'}</AlertTitle>
          <AlertDescription>{saveError ?? (saveState === 'conflict' ? 'Sunucudaki güncel QR stili yüklendi.' : 'Lütfen tekrar deneyin.')}</AlertDescription>
          {saveState === 'error' && <AlertAction><Button type="button" variant="outline" size="xs" onClick={onRetry}>Tekrar dene</Button></AlertAction>}
        </Alert>
      )}
    </div>
  )
}

export function TablesQRPropertiesTabs({ activeTab, onChange }: {
  activeTab: QRPropertiesTab
  onChange: (tab: QRPropertiesTab) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active]')
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTab])
  return (
    <TabsList variant="line" ref={listRef} className="tb-tables__props-tabs h-11 w-full justify-start overflow-x-auto rounded-none border-b px-3" aria-label="QR stüdyosu ayarları">
      {QR_PROPERTY_TABS.map((item) => {
        const Icon = TAB_ICONS[item.icon]
        return <TabsTrigger key={item.id} value={item.id} onClick={() => onChange(item.id)} className="px-2.5"><Icon data-icon="inline-start" />{item.label}</TabsTrigger>
      })}
    </TabsList>
  )
}

export function TablesQRPropertiesFooter({ tableCount, onReset }: { tableCount: number; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between border-t bg-muted/30 p-3">
      <Button type="button" variant="ghost" size="sm" onClick={onReset}><RotateCcw data-icon="inline-start" />Stili sıfırla</Button>
      <Badge variant="secondary">{tableCount} masa</Badge>
    </div>
  )
}
