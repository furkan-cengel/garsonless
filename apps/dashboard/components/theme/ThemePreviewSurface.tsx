'use client'

import type { RefObject } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface ThemePreviewSurfaceProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  status: ThemePreviewStatus
  theme: GarsonlessTheme
  onRetry: () => void
  onLoad: () => void
  onError: () => void
}

export function ThemePreviewSurface({ iframeRef, previewUrl, status, theme, onRetry, onLoad, onError }: ThemePreviewSurfaceProps) {
  return (
    <>
      <iframe
        ref={iframeRef}
        src={previewUrl}
        onLoad={onLoad}
        onError={onError}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: '100%', height: '100%', border: 'none',
          opacity: status === 'preparing' || status === 'error' ? 0 : 1,
        }}
        data-preview-state={status}
        title="Menü tema önizlemesi"
      />
      {status === 'preparing' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'grid', placeItems: 'center',
            background: theme.bg,
            color: theme.accent,
          }}
        >
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <Spinner aria-hidden="true" style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Önizleme hazırlanıyor</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div
          role="alert"
          style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'grid', placeItems: 'center', padding: 24,
            background: theme.bg, color: theme.textColor,
          }}
        >
          <Alert className="max-w-xs text-center" style={{ background: theme.bg, color: theme.textColor }}>
            <AlertTitle>Önizleme yüklenemedi</AlertTitle>
            <AlertDescription style={{ color: theme.mutedTextColor }}>
              Menü önizlemesi yanıt vermedi. Tasarım değişiklikleriniz korunuyor.
            </AlertDescription>
            <Button type="button" size="sm" onClick={onRetry} className="mx-auto mt-3 min-w-[118px]">
              Yeniden dene
            </Button>
          </Alert>
        </div>
      )}
    </>
  )
}
