'use client'

import type { RefObject } from 'react'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface ThemePreviewSurfaceProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  status: ThemePreviewStatus
  onLoad: () => void
  onError: () => void
}

export function ThemePreviewSurface({ iframeRef, previewUrl, status, onLoad, onError }: ThemePreviewSurfaceProps) {
  return (
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
  )
}

export function ThemePreviewStatusOverlay({ status, onRetry }: { status: ThemePreviewStatus; onRetry: () => void }) {
  if (status === 'ready' || status === 'stale') return null

  if (status === 'preparing') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy="true"
        data-theme-preview-status-overlay="preparing"
        style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'grid', placeItems: 'center',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <Spinner aria-hidden="true" style={{ width: 24, height: 24, color: 'var(--text)' }} />
          <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 700 }}>Önizleme hazırlanıyor</span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      data-theme-preview-status-overlay="error"
      style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'grid', placeItems: 'center', padding: 16,
        background: 'var(--surface)', color: 'var(--text)',
      }}
    >
      <Alert className="max-w-xs bg-background text-center text-foreground">
        <AlertTitle>Önizleme yüklenemedi</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Menü önizlemesi yanıt vermedi. Tasarım değişiklikleriniz korunuyor.
        </AlertDescription>
        <Button type="button" onClick={onRetry} className="mx-auto mt-3 min-h-11 min-w-[118px]">
          Yeniden dene
        </Button>
      </Alert>
    </div>
  )
}
