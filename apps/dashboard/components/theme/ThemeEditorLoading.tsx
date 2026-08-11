import { Skeleton } from '@/components/ui/skeleton'

export function ThemeEditorLoading() {
  return (
    <div data-theme-editor-loading role="status" aria-live="polite" aria-busy="true" aria-label="Tema düzenleyici hazırlanıyor" style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'grid',
      gridTemplateColumns: '320px minmax(0, 1fr)',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <div aria-hidden="true" style={{ display: 'contents' }}>
      <div data-theme-editor-loading-nav style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <Skeleton style={{ width: 180, height: 18 }} />
        <Skeleton style={{ width: 240, height: 34 }} />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} style={{ width: `${86 - (index % 3) * 9}%`, height: 28 }} />
        ))}
      </div>
      <div data-theme-editor-loading-preview style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <Skeleton style={{ width: 220, height: 32 }} />
          <Skeleton style={{ width: 180, height: 32 }} />
        </div>
        <div style={{
          flex: 1,
          minHeight: 420,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface)',
          display: 'grid',
          placeItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Skeleton style={{ width: 120, height: 120, borderRadius: 28 }} />
            <Skeleton style={{ width: 180, height: 16 }} />
          </div>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          [data-theme-editor-loading] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          [data-theme-editor-loading-nav] {
            display: none !important;
          }
          [data-theme-editor-loading-preview] {
            padding: 12px !important;
          }
        }
      `}</style>
      </div>
    </div>
  )
}
