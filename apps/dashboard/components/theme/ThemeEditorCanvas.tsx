'use client'

import type { RefObject } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import type { ThemePreviewMode } from './ThemeEditorTopbar'
import { ThemePreviewSurface } from './ThemePreviewSurface'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'

interface ThemeEditorCanvasProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  previewStatus: ThemePreviewStatus
  previewTheme: GarsonlessTheme
  previewMode: ThemePreviewMode
  previewScale: number
  isNarrow: boolean
  onZoom: (delta: number) => void
  onFit: () => void
}

export function ThemeEditorCanvas({
  iframeRef,
  previewUrl,
  previewStatus,
  previewTheme,
  previewMode,
  previewScale,
  isNarrow,
  onZoom,
  onFit,
}: ThemeEditorCanvasProps) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: 'var(--surface-inset)',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0)',
      backgroundSize: '20px 20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        minHeight: 40,
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px 12px',
        padding: '6px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,.72)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 12, minWidth: 0, flex: '1 1 260px' }}>
          <span style={{ fontWeight: 650, color: 'var(--text)' }}>Önizleme</span>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewUrl.replace(/^https?:\/\//, '')}
          </span>
          {previewStatus === 'degraded' && (
            <span
              role="status"
              title="Tema onayı zamanında alınamadı; önizleme yine de gösteriliyor."
              style={{
                flexShrink: 0,
                padding: '2px 6px',
                borderRadius: 5,
                background: 'var(--warning-bg)',
                color: 'var(--warning)',
                fontSize: 10.5,
                fontWeight: 650,
              }}
            >
              Sınırlı önizleme
            </span>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: 24,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-2)',
              textDecoration: 'none',
              fontSize: 11.5,
              fontWeight: 600,
            }}
          >
            <I.globe size={17} />
            Aç
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 7,
            background: 'var(--surface)',
            overflow: 'hidden',
          }}>
            <button type="button" aria-label="Önizlemeyi küçült" onClick={() => onZoom(-0.1)} style={zoomButtonStyle}>−</button>
            <output style={{ minWidth: 48, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
              %{Math.round(previewScale * 100)}
            </output>
            <button type="button" aria-label="Önizlemeyi büyüt" onClick={() => onZoom(0.1)} style={zoomButtonStyle}>+</button>
          </div>
          <button type="button" onClick={onFit} style={{ ...canvasButtonStyle, height: 28 }}>Sığdır</button>
        </div>
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isNarrow ? '22px 16px' : '32px 24px',
        overflow: 'auto',
        minWidth: isNarrow ? 500 : 0,
      }}>
        <PreviewFrame mode={previewMode} scale={previewScale}>
          <ThemePreviewSurface
            iframeRef={iframeRef}
            previewUrl={previewUrl}
            status={previewStatus}
            theme={previewTheme}
          />
        </PreviewFrame>
      </div>
    </div>
  )
}

function PreviewFrame({ children, mode, scale }: {
  children: React.ReactNode
  mode: ThemePreviewMode
  scale: number
}) {
  const width = mode === 'desktop' ? 1_040 : 390
  const height = mode === 'desktop' ? 720 : 760

  return (
    <div style={{
      width: width * scale,
      height: height * scale,
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        borderRadius: mode === 'desktop' ? 20 : 44,
        background: mode === 'desktop' ? 'var(--surface)' : '#0b0b0d',
        padding: mode === 'desktop' ? 0 : 10,
        boxShadow: mode === 'desktop'
          ? '0 30px 80px -28px rgba(0,0,0,.28), 0 0 0 1px var(--border)'
          : '0 30px 60px -20px rgba(0,0,0,.25), 0 0 0 .5px #0b0b0d',
      }}>
        <div style={{
          width: '100%',
          height: mode === 'desktop' ? '100%' : height - 20,
          borderRadius: mode === 'desktop' ? 20 : 34,
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const canvasButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
}

const zoomButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-2)',
  cursor: 'pointer',
}
