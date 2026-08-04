'use client'

import type { RefObject } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'

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
      <style jsx>{`
        @keyframes theme-preview-spin { to { transform: rotate(360deg); } }
        .theme-preview-spinner { animation: theme-preview-spin 700ms linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .theme-preview-spinner { animation: none; }
        }
      `}</style>
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
            <span className="theme-preview-spinner" aria-hidden="true" style={{
              width: 22, height: 22, borderRadius: 999,
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
            }} />
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
          <div style={{ maxWidth: 320, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: 16 }}>Önizleme yüklenemedi</strong>
            <p style={{ margin: '8px 0 16px', color: theme.mutedTextColor, fontSize: 13, lineHeight: 1.5 }}>
              Menü önizlemesi yanıt vermedi. Tasarım değişiklikleriniz korunuyor.
            </p>
            <button type="button" onClick={onRetry} style={retryButtonStyle}>
              Yeniden dene
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const retryButtonStyle: React.CSSProperties = {
  minWidth: 118,
  height: 36,
  padding: '0 16px',
  border: 0,
  borderRadius: 10,
  background: 'var(--action)',
  color: 'var(--on-action)',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}
