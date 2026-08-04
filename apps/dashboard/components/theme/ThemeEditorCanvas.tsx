'use client'

import type { RefObject } from 'react'
import type { GarsonlessTheme, ThemeEditorSurface } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import type { ThemePreviewMode } from './ThemeEditorTopbar'
import { ThemeExperienceSurfaceSelector } from './ThemeExperienceSurfaceSelector'
import { ThemePreviewSurface } from './ThemePreviewSurface'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'

interface ThemeEditorCanvasProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  previewStatus: ThemePreviewStatus
  previewTheme: GarsonlessTheme
  previewMode: ThemePreviewMode
  previewScale: number
  isTaskBased: boolean
  experienceSurface: ThemeEditorSurface
  homeEnabled: boolean
  experienceV2Enabled: boolean
  onPreviewRetry: () => void
  onPreviewLoad: () => void
  onPreviewError: () => void
  onPreviewModeChange: (mode: ThemePreviewMode) => void
  onExperienceSurfaceChange: (surface: ThemeEditorSurface) => void
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
  isTaskBased,
  experienceSurface,
  homeEnabled,
  experienceV2Enabled,
  onPreviewRetry,
  onPreviewLoad,
  onPreviewError,
  onPreviewModeChange,
  onExperienceSurfaceChange,
  onZoom,
  onFit,
}: ThemeEditorCanvasProps) {
  return (
    <div role="region" aria-labelledby="theme-editor-preview-heading" style={{
      flex: 1,
      minWidth: 0,
      background: 'var(--surface-inset)',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0)',
      backgroundSize: '20px 20px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div data-theme-editor-preview-toolbar style={{
        minHeight: 40,
        flexShrink: 0,
        position: 'relative',
        zIndex: 40,
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
          <h2 id="theme-editor-preview-heading" style={{ margin: 0, fontSize: 12, lineHeight: 1.2, fontWeight: 650, color: 'var(--text)' }}>Önizleme</h2>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewUrl.replace(/^https?:\/\//, '')}
          </span>
          {previewStatus === 'stale' && (
            <span
              role="status"
              title="Son başarılı önizleme gösteriliyor; güncel tema onayı zamanında alınamadı."
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
              Güncelleme gecikti
            </span>
          )}
          {previewStatus === 'stale' && (
            <button type="button" onClick={onPreviewRetry} style={{ ...previewRetryButtonStyle, minHeight: isTaskBased ? 44 : 32 }}>
              Yeniden dene
            </button>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              height: 34,
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
          {experienceV2Enabled && (
            <ThemeExperienceSurfaceSelector
              value={experienceSurface}
              homeEnabled={homeEnabled}
              onChange={onExperienceSurfaceChange}
            />
          )}
          {isTaskBased && (
            <div
              role="group"
              aria-label="Önizleme cihazı"
              style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 9, background: 'var(--surface-3)' }}
            >
              <DeviceButton
                active={previewMode === 'mobile'}
                label="Mobil önizleme"
                onClick={() => onPreviewModeChange('mobile')}
              ><I.phone size={17} /></DeviceButton>
              <DeviceButton
                active={previewMode === 'desktop'}
                label="Masaüstü önizleme"
                onClick={() => onPreviewModeChange('desktop')}
              ><I.monitor size={17} /></DeviceButton>
            </div>
          )}
          <div style={{
            height: 34,
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
          <button type="button" onClick={onFit} style={canvasButtonStyle}>Sığdır</button>
        </div>
      </div>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isTaskBased ? '16px 12px' : '32px 24px',
        overflow: 'auto',
        minWidth: 0,
      }}>
        <PreviewFrame mode={previewMode} scale={previewScale}>
          <ThemePreviewSurface
            iframeRef={iframeRef}
            previewUrl={previewUrl}
            status={previewStatus}
            theme={previewTheme}
            onRetry={onPreviewRetry}
            onLoad={onPreviewLoad}
            onError={onPreviewError}
          />
        </PreviewFrame>
      </div>
    </div>
  )
}

function DeviceButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        border: 0,
        borderRadius: 7,
        display: 'inline-grid',
        placeItems: 'center',
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-3)',
        boxShadow: active ? 'var(--shadow-1)' : 'none',
        cursor: 'pointer',
      }}
    >{children}</button>
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
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-2)',
  cursor: 'pointer',
}

const previewRetryButtonStyle: React.CSSProperties = {
  minHeight: 32,
  padding: '0 9px',
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
}
