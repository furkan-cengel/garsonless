'use client'

import type { RefObject } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'

interface ThemePreviewSurfaceProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  status: ThemePreviewStatus
  theme: GarsonlessTheme
}

export function ThemePreviewSurface({ iframeRef, previewUrl, status, theme }: ThemePreviewSurfaceProps) {
  return (
    <>
      <iframe
        ref={iframeRef}
        src={previewUrl}
        style={{
          width: '100%', height: '100%', border: 'none',
          opacity: status === 'preparing' ? 0 : 1,
        }}
        data-preview-state={status}
        title="Menu Preview"
      />
      {status === 'preparing' && (
        <div
          aria-label="Önizleme hazırlanıyor"
          style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'grid', placeItems: 'center',
            background: theme.bg,
            color: theme.accent,
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 999,
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            animation: 'spin 700ms linear infinite',
          }} />
        </div>
      )}
    </>
  )
}
