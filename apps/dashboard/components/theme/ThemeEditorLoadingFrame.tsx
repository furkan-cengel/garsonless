import { Skeleton } from '../../lib/ui'

interface ThemeEditorLoadingFrameProps {
  label?: string
}

const LOADING_FRAME_CSS = `
  .theme-editor-loading-frame {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--surface-inset);
    color: var(--text);
  }
  .theme-editor-loading-visuals {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .theme-editor-loading-topbar {
    height: 52px;
    min-height: 52px;
    display: grid;
    grid-template-columns: minmax(0, .8fr) auto minmax(0, 1.2fr);
    align-items: center;
    gap: 16px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .theme-editor-loading-context,
  .theme-editor-loading-actions,
  .theme-editor-loading-device {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .theme-editor-loading-device {
    justify-self: center;
    padding: 3px;
    border-radius: 9px;
    background: var(--surface-3);
  }
  .theme-editor-loading-actions { justify-content: flex-end; }
  .theme-editor-loading-task-nav {
    display: none;
    min-height: 44px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .theme-editor-loading-workspace {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 320px;
    overflow: hidden;
  }
  .theme-editor-loading-sidebar,
  .theme-editor-loading-properties {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 14px;
    background: var(--surface);
  }
  .theme-editor-loading-sidebar { border-right: 1px solid var(--border); }
  .theme-editor-loading-properties { border-left: 1px solid var(--border); }
  .theme-editor-loading-list { display: flex; flex-direction: column; gap: 9px; }
  .theme-editor-loading-canvas {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--surface-inset);
  }
  .theme-editor-loading-preview-toolbar {
    min-height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 86%, transparent);
  }
  .theme-editor-loading-preview-stage {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: grid;
    place-items: center;
    padding: 16px 12px;
  }
  .theme-editor-loading-phone {
    height: min(760px, calc(100% - 8px));
    width: auto;
    max-width: calc(100% - 8px);
    aspect-ratio: 390 / 760;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 10px;
    border-radius: 44px;
    background: #0b0b0d;
    box-shadow: 0 24px 58px -28px rgba(0,0,0,.32);
  }
  .theme-editor-loading-screen {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 16px;
    border-radius: 34px;
    background: var(--surface);
  }
  .theme-editor-loading-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @media (min-width: 901px) and (max-width: 1319px) {
    .theme-editor-loading-workspace { grid-template-columns: 260px minmax(0, 1fr) 300px; }
  }
  @media (max-width: 900px) {
    .theme-editor-loading-topbar {
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 8px;
      padding: 6px 12px;
    }
    .theme-editor-loading-context > :not(:first-child),
    .theme-editor-loading-device { display: none; }
    .theme-editor-loading-actions { grid-column: 2; gap: 5px; }
    .theme-editor-loading-actions > :first-child { margin-right: auto; }
    .theme-editor-loading-task-nav { display: grid; }
    .theme-editor-loading-workspace { display: flex; }
    .theme-editor-loading-sidebar,
    .theme-editor-loading-properties { display: none; }
    .theme-editor-loading-canvas { flex: 1; }
  }
  @media (max-width: 649px) {
    .theme-editor-loading-topbar { padding: 6px 8px; }
    .theme-editor-loading-actions > :first-child { display: none; }
    .theme-editor-loading-actions > * { width: 64px !important; }
    .theme-editor-loading-actions > :last-child { width: 70px !important; }
    .theme-editor-loading-preview-toolbar { padding-inline: 10px; }
    .theme-editor-loading-preview-toolbar > :first-child { width: 34% !important; }
    .theme-editor-loading-preview-toolbar > :last-child { width: 42% !important; }
    .theme-editor-loading-preview-stage { padding: 12px 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .theme-editor-loading-frame .dashboard-skeleton { animation: none !important; }
  }
`

function LoadingBlock({ width = '100%', height = 14, radius = 6 }: { width?: number | string; height?: number | string; radius?: number }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: radius }} />
}

function LoadingList({ rows }: { rows: number }) {
  return (
    <div className="theme-editor-loading-list">
      {Array.from({ length: rows }, (_, index) => (
        <LoadingBlock key={index} width={`${88 - (index % 3) * 11}%`} height={index % 4 === 0 ? 34 : 28} />
      ))}
    </div>
  )
}

export function ThemeEditorLoadingFrame({ label = 'Tema düzenleyici hazırlanıyor' }: ThemeEditorLoadingFrameProps) {
  return (
    <div className="theme-editor-loading-frame" data-theme-editor-loading role="status" aria-live="polite" aria-atomic="true" aria-busy="true" aria-label={label}>
      <style>{LOADING_FRAME_CSS}</style>
      <div className="theme-editor-loading-visuals" aria-hidden="true">
        <div className="theme-editor-loading-topbar">
          <div className="theme-editor-loading-context">
            <LoadingBlock width={28} height={28} radius={8} />
            <LoadingBlock width={82} height={16} />
            <LoadingBlock width={118} height={16} />
          </div>
          <div className="theme-editor-loading-device">
            <LoadingBlock width={74} height={28} radius={7} />
            <LoadingBlock width={92} height={28} radius={7} />
          </div>
          <div className="theme-editor-loading-actions">
            <LoadingBlock width={92} height={28} radius={999} />
            <LoadingBlock width={32} height={32} radius={8} />
            <LoadingBlock width={78} height={34} radius={8} />
            <LoadingBlock width={108} height={34} radius={8} />
          </div>
        </div>

        <div className="theme-editor-loading-task-nav">
          <LoadingBlock height={36} radius={9} />
          <LoadingBlock height={36} radius={9} />
          <LoadingBlock height={36} radius={9} />
        </div>

        <div className="theme-editor-loading-workspace">
          <div className="theme-editor-loading-sidebar">
            <LoadingBlock width={132} height={18} />
            <LoadingBlock height={38} radius={9} />
            <LoadingList rows={10} />
          </div>

          <div className="theme-editor-loading-canvas">
            <div className="theme-editor-loading-preview-toolbar">
              <LoadingBlock width={220} height={28} radius={8} />
              <LoadingBlock width={250} height={30} radius={8} />
            </div>
            <div className="theme-editor-loading-preview-stage">
              <div className="theme-editor-loading-phone">
                <div className="theme-editor-loading-screen">
                  <LoadingBlock width="52%" height={30} radius={8} />
                  <LoadingBlock width="100%" height={48} radius={10} />
                  <LoadingBlock width="42%" height={22} />
                  <div className="theme-editor-loading-card-grid">
                    <LoadingBlock height={188} radius={12} />
                    <LoadingBlock height={188} radius={12} />
                    <LoadingBlock height={188} radius={12} />
                    <LoadingBlock height={188} radius={12} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="theme-editor-loading-properties">
            <LoadingBlock width={112} height={18} />
            <LoadingBlock width="64%" height={13} />
            <LoadingList rows={10} />
          </div>
        </div>
      </div>
    </div>
  )
}
