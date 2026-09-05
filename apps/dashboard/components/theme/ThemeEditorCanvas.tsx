'use client'

import type { RefObject } from 'react'
import type { ThemeEditorSurface } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import type { ThemePreviewMode } from './ThemeEditorTopbar'
import { ThemeExperienceSurfaceSelector } from './ThemeExperienceSurfaceSelector'
import { ThemePreviewStatusOverlay, ThemePreviewSurface } from './ThemePreviewSurface'
import type { ThemePreviewStatus } from './use-theme-preview-bridge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react'

interface ThemeEditorCanvasProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewUrl: string
  previewFrameUrl: string
  previewStatus: ThemePreviewStatus
  previewMode: ThemePreviewMode
  previewScale: number
  isTaskBased: boolean
  experienceSurface: ThemeEditorSurface
  homeEnabled: boolean
  experienceV2Enabled: boolean
  canUseGuestOrdering: boolean
  onPreviewRetry: () => void
  onPreviewLoad: () => void
  onPreviewError: () => void
  onPreviewModeChange: (mode: ThemePreviewMode) => void
  onExperienceSurfaceChange: (surface: ThemeEditorSurface) => void
  onLockedExperienceSurface: (surface: ThemeEditorSurface) => void
  onZoom: (delta: number) => void
  onFit: () => void
}

export function ThemeEditorCanvas({
  iframeRef,
  previewUrl,
  previewFrameUrl,
  previewStatus,
  previewMode,
  previewScale,
  isTaskBased,
  experienceSurface,
  homeEnabled,
  experienceV2Enabled,
  canUseGuestOrdering,
  onPreviewRetry,
  onPreviewLoad,
  onPreviewError,
  onPreviewModeChange,
  onExperienceSurfaceChange,
  onLockedExperienceSurface,
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
          <h2 id="theme-editor-preview-heading" style={{ margin: 0, fontSize: 12, lineHeight: 1.2, fontWeight: 650, color: 'var(--text)' }}>Taslak önizlemesi</h2>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Henüz yayına alınmamış değişiklikleri de gösterir
          </span>
          {previewStatus === 'stale' && (
            <Badge
              variant="warning"
              role="status"
              title="Son başarılı önizleme gösteriliyor; güncel tema onayı zamanında alınamadı."
            >
              Güncelleme gecikti
            </Badge>
          )}
          {previewStatus === 'stale' && (
            <Button type="button" variant="outline" size={isTaskBased ? 'lg' : 'default'} onClick={onPreviewRetry}>
              Yeniden dene
            </Button>
          )}
          <a
            href={previewUrl}
            target="_blank"
            aria-label="Yayınlanmış tasarımı yeni sekmede aç"
            title="Yeni sekmede yayınlanmış tasarım açılır; taslak bu editörde önizlenir"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-[34px]')}
          >
            <I.globe data-icon="inline-start" />
            Yayındaki tasarım
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {experienceV2Enabled && (
            <ThemeExperienceSurfaceSelector
              value={experienceSurface}
              homeEnabled={homeEnabled}
              canUseGuestOrdering={canUseGuestOrdering}
              onLockedSurface={onLockedExperienceSurface}
              onChange={onExperienceSurfaceChange}
            />
          )}
          {isTaskBased && (
            <ToggleGroup
              value={[previewMode]}
              onValueChange={(values) => { const next = values[0] as ThemePreviewMode | undefined; if (next) onPreviewModeChange(next) }}
              aria-label="Önizleme cihazı"
              spacing={1}
              size="sm"
              className="bg-muted p-1"
            >
              <ToggleGroupItem value="mobile" aria-label="Mobil önizleme"><I.phone /></ToggleGroupItem>
              <ToggleGroupItem value="desktop" aria-label="Masaüstü önizleme"><I.monitor /></ToggleGroupItem>
            </ToggleGroup>
          )}
          <ButtonGroup aria-label="Önizleme yakınlaştırma" data-theme-preview-zoom className="h-8">
            <Button type="button" variant="outline" size="icon" aria-label="Önizlemeyi küçült" onClick={() => onZoom(-0.1)}><ZoomOutIcon data-icon="inline-start" /></Button>
            <ButtonGroupText render={<output data-theme-preview-zoom-value aria-live="polite" className="h-8 min-w-10 justify-center px-1.5 text-xs tabular-nums whitespace-nowrap" />}>
              %{Math.round(previewScale * 100)}
            </ButtonGroupText>
            <Button type="button" variant="outline" size="icon" aria-label="Önizlemeyi büyüt" onClick={() => onZoom(0.1)}><ZoomInIcon data-icon="inline-start" /></Button>
          </ButtonGroup>
          <Button type="button" variant="outline" onClick={onFit}>Sığdır</Button>
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
        <PreviewFrame
          mode={previewMode}
          scale={previewScale}
          overlay={previewStatus === 'ready' || previewStatus === 'stale'
            ? null
            : <ThemePreviewStatusOverlay status={previewStatus} onRetry={onPreviewRetry} />}
        >
          <ThemePreviewSurface
            iframeRef={iframeRef}
            previewUrl={previewFrameUrl}
            status={previewStatus}
            onLoad={onPreviewLoad}
            onError={onPreviewError}
          />
        </PreviewFrame>
      </div>
    </div>
  )
}

function PreviewFrame({ children, mode, scale, overlay }: {
  children: React.ReactNode
  mode: ThemePreviewMode
  scale: number
  overlay: React.ReactNode
}) {
  const width = mode === 'desktop' ? 1_040 : 390
  const height = mode === 'desktop' ? 720 : 760

  return (
    <div data-theme-preview-frame-host style={{
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
      {overlay && (
        <div
          data-theme-preview-unscaled-overlay
          style={{
            position: 'absolute',
            inset: mode === 'desktop' ? 0 : 10 * scale,
            overflow: 'hidden',
            borderRadius: (mode === 'desktop' ? 20 : 34) * scale,
            pointerEvents: 'auto',
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  )
}
