'use client'

import dynamic from 'next/dynamic'
import type { GarsonlessTheme } from '@garsonless/design-engine'

interface Props {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  canAddAdvancedSections: boolean
  templateId: string
  initialTheme: GarsonlessTheme
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
}

const ThemeEditorClient = dynamic(() => import('./ThemeEditorClient'), {
  loading: () => <ThemeEditorLoading />,
})

function ThemeEditorLoading() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'grid',
      gridTemplateColumns: '320px minmax(0, 1fr)',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <div style={{
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
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    </div>
  )
}

function Skeleton({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
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

export default function ThemeEditorClientLoader(props: Props) {
  return <ThemeEditorClient {...props} />
}
