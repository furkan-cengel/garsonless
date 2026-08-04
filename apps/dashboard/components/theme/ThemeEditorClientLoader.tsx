'use client'

import dynamic from 'next/dynamic'
import type { ThemeEditorClientProps } from './theme-editor-client-contract'

const ThemeEditorClient = dynamic(() => import('./ThemeEditorClient'), {
  loading: () => <ThemeEditorLoading />,
})

function ThemeEditorLoading() {
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
        @media (prefers-reduced-motion: reduce) {
          [data-theme-editor-skeleton] { animation: none !important; }
        }
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

function Skeleton({ style }: { style: React.CSSProperties }) {
  return (
    <div data-theme-editor-skeleton aria-hidden="true" style={{
      borderRadius: 7,
      background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))',
      backgroundSize: '220% 100%',
      animation: 'theme-editor-skeleton 1.2s ease-in-out infinite',
      ...style,
    }}>
      <style jsx>{`
        @keyframes theme-editor-skeleton {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  )
}

export default function ThemeEditorClientLoader(props: ThemeEditorClientProps) {
  return <ThemeEditorClient {...props} />
}
