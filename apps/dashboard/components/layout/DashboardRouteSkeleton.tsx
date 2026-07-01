import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '../../lib/ui'

type SkeletonKind = 'pano' | 'analytics' | 'orders' | 'menu' | 'theme' | 'tables' | 'settings' | 'customers'

interface Props {
  kind?: SkeletonKind
}

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--bg)',
}

function Block({ height, width = '100%', style }: { height: number | string; width?: number | string; style?: CSSProperties }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: 6, ...style }} />
}

function TopBarSkeleton({ kind }: { kind: SkeletonKind }) {
  const isMenu = kind === 'menu'
  const isCustomers = kind === 'customers'
  return (
    <div style={{
      height: 'var(--topbar)',
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: 12,
      padding: '0 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Block width={26} height={26} style={{ borderRadius: 7, flexShrink: 0 }} />
        <Block width={84} height={13} />
        <Block width={1} height={28} style={{ borderRadius: 0, flexShrink: 0 }} />
        <Block width={112} height={24} />
        <Block width={46} height={12} />
      </div>
      {isMenu ? (
        <Block width="min(420px, 34vw)" height={32} style={{ minWidth: 300 }} />
      ) : isCustomers ? (
        <div />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <KpiShadow />
          <KpiShadow />
          <KpiShadow />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
        {isMenu ? (
          <>
            <Block width={84} height={30} />
            <Block width={78} height={30} />
            <Block width={92} height={30} />
          </>
        ) : isCustomers ? null : (
          <Block width={118} height={30} />
        )}
        <Block width={30} height={30} style={{ borderRadius: 7 }} />
      </div>
    </div>
  )
}

function KpiShadow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Block width={7} height={7} style={{ borderRadius: 999 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Block width={44} height={9} />
        <Block width={58} height={14} />
      </div>
    </div>
  )
}

function MetricRow({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 14 }}>
          <Block width={i % 2 ? 92 : 118} height={11} />
          <Block width={i % 2 ? 70 : 86} height={26} style={{ marginTop: 14 }} />
          <Block width="62%" height={10} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}

function PanoSkeleton() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
      <MetricRow />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, .8fr)', gap: 14, minHeight: 0, flex: 1 }}>
        <Panel rows={8} />
        <Panel rows={5} />
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Block width={210} height={34} />
        <Block width={184} height={34} />
      </div>
      <MetricRow />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 14, minHeight: 0, flex: 1 }}>
        <Panel rows={10} chart />
        <Panel rows={7} />
      </div>
    </div>
  )
}

function OrdersSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <NavRailSkeleton rows={4} search footer />
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 16px 32px', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <KanbanColumnShadow key={i} count={i === 0 ? 4 : i === 1 ? 3 : 2} />
          ))}
        </div>
      </div>
      <DetailPanelShadow />
    </div>
  )
}

function KanbanColumnShadow({ count }: { count: number }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 220,
      background: 'var(--surface-2)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--divider)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--divider)',
      }}>
        <Block width={28} height={20} style={{ borderRadius: 999 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Block width={76} height={13} />
          <Block width={94} height={10} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <OrderCardShadow key={i} dense={i > 1} />
        ))}
      </div>
    </div>
  )
}

function OrderCardShadow({ dense = false }: { dense?: boolean }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-1)',
      padding: '10px 12px 10px 15px',
      minHeight: dense ? 82 : 116,
    }}>
      <Block width={3} height="100%" style={{ position: 'absolute', left: 0, top: 0, borderRadius: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Block width="46%" height={14} />
          <Block width="32%" height={10} />
        </div>
        <Block width={48} height={16} />
      </div>
      {!dense && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--divider)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Block width="72%" height={11} />
          <Block width="58%" height={11} />
        </div>
      )}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between' }}>
        <Block width={72} height={18} style={{ borderRadius: 999 }} />
        <Block width={64} height={22} />
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <CategoryRailShadow />
      <MenuCanvasShadow />
      <EmptyPropsShadow />
    </div>
  )
}

function CategoryRailShadow() {
  return (
    <div style={{ width: 'var(--nav)', flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Block width={112} height={16} />
          <Block width={18} height={11} />
        </div>
        <Block width={150} height={11} style={{ marginTop: 10 }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '18px 8px 8px' }}>
        <CategoryRowShadow active />
        <Block height={35} style={{ margin: '4px 0 8px 20px', background: 'transparent', border: '1px dashed var(--border)' }} />
        <CategoryRowShadow />
        <CategoryRowShadow />
        <Block height={35} style={{ marginTop: 18, background: 'transparent', border: '1px dashed var(--border-strong)' }} />
      </div>
      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Block height={10} width="100%" />
        <Block height={10} width="92%" />
        <Block height={10} width="78%" />
      </div>
    </div>
  )
}

function CategoryRowShadow({ active = false }: { active?: boolean }) {
  return (
    <div style={{
      height: 39,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 8px',
      marginBottom: 1,
      borderRadius: 7,
      background: active ? 'var(--surface-inset)' : 'transparent',
    }}>
      <Block width={20} height={20} style={{ borderRadius: 5, flexShrink: 0 }} />
      <Block width="52%" height={13} />
      <div style={{ flex: 1 }} />
      <Block width={18} height={10} />
      <Block width={18} height={18} style={{ borderRadius: 5 }} />
    </div>
  )
}

function MenuCanvasShadow() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <Block width={106} height={18} />
            <Block width={132} height={11} style={{ marginTop: 8 }} />
          </div>
          <Block width={86} height={26} style={{ borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Block width={72} height={30} />
          <Block width={72} height={30} />
          <Block width={58} height={30} />
          <Block width={1} height={22} style={{ borderRadius: 0 }} />
          <Block width={84} height={28} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <MenuCardShadow key={i} />
          ))}
          <div style={{ aspectRatio: '4 / 3', minHeight: 200, border: '1.5px dashed var(--border-strong)', borderRadius: 10 }} />
        </div>
      </div>
    </div>
  )
}

function MenuCardShadow() {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
      <Block height="auto" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <Block width="64%" height={14} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Block width={48} height={15} />
          <Block width={46} height={22} style={{ borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}

function ThemeSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '272px minmax(0, 1fr) 340px', height: '100%', minHeight: 0 }}>
      <NavRailSkeleton compact rows={8} />
      <div style={{ padding: 20, minHeight: 0, background: 'var(--bg)' }}>
        <Block height="100%" style={{ minHeight: 420, borderRadius: 10 }} />
      </div>
      <Panel rows={10} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none' }} />
    </div>
  )
}

function TablesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <NavRailSkeleton rows={9} />
        <div style={{ flex: 1, minWidth: 0, padding: 20, display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}>
          <div style={{ width: 'min(56vw, 560px)', aspectRatio: '1 / 1', position: 'relative' }}>
            <Block width="100%" height="100%" style={{ borderRadius: 8 }} />
            <Block width="34%" height={24} style={{ position: 'absolute', top: '12%', left: '10%' }} />
            <Block width="28%" height={24} style={{ position: 'absolute', top: '38%', right: '12%' }} />
            <Block width="30%" height={24} style={{ position: 'absolute', bottom: '15%', left: '28%' }} />
          </div>
        </div>
        <Panel rows={10} style={{ width: 'var(--props)', flexShrink: 0, borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none' }} />
      </div>
      <div style={{ height: 'var(--statusbar)', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
        <Block width={160} height={10} />
        <Block width={220} height={10} />
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <NavRailSkeleton rows={12} grouped />
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 32px 60px' }}>
          <Block width={140} height={11} />
          <Block width={240} height={26} style={{ marginTop: 12 }} />
          <Block width="62%" height={14} style={{ marginTop: 10, marginBottom: 28 }} />
          <FormPanelShadow rows={5} />
          <FormPanelShadow rows={7} style={{ marginTop: 14 }} />
        </div>
      </div>
    </div>
  )
}

function NavRailSkeleton({
  rows,
  compact = false,
  search = false,
  footer = false,
  grouped = false,
}: {
  rows: number
  compact?: boolean
  search?: boolean
  footer?: boolean
  grouped?: boolean
}) {
  return (
    <div style={{
      width: compact ? 272 : 'var(--nav)',
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)' }}>
        <Block width={compact ? 112 : 92} height={14} />
        <Block width={compact ? 168 : 138} height={11} style={{ marginTop: 7 }} />
      </div>
      {search && (
        <div style={{ padding: '8px 12px 4px' }}>
          <Block height={30} style={{ borderRadius: 7 }} />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden', padding: '6px 8px 12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ marginTop: grouped && i % 4 === 0 ? 12 : 0 }}>
            {grouped && i % 4 === 0 && <Block width={74} height={9} style={{ margin: '0 8px 7px' }} />}
            <NavRowShadow twoLine={!compact && grouped} count={search} />
          </div>
        ))}
      </div>
      {footer && (
        <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)' }}>
          <Block height={30} />
        </div>
      )}
    </div>
  )
}

function NavRowShadow({ twoLine = false, count = false }: { twoLine?: boolean; count?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', marginBottom: 1, borderRadius: 7 }}>
      <Block width={16} height={16} style={{ borderRadius: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Block width={twoLine ? '58%' : '64%'} height={12} />
        {twoLine && <Block width="76%" height={9} />}
      </div>
      {count && <Block width={18} height={10} />}
    </div>
  )
}

function EmptyPropsShadow() {
  return (
    <div style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Block width={56} height={56} style={{ borderRadius: 14, marginBottom: 14 }} />
      <Block width={132} height={14} />
      <Block width={220} height={12} style={{ marginTop: 10 }} />
      <Block width={180} height={12} style={{ marginTop: 6 }} />
    </div>
  )
}

function DetailPanelShadow() {
  return (
    <div style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Block width={96} height={16} />
            <Block width={88} height={11} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Block width={30} height={30} style={{ borderRadius: 7 }} />
            <Block width={30} height={30} style={{ borderRadius: 7 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => <Block key={i} height={18} style={{ borderRadius: 999 }} />)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelSectionShadow rows={4} />
        <PanelSectionShadow rows={3} />
        <PanelSectionShadow rows={2} />
      </div>
      <div style={{ borderTop: '1px solid var(--divider)', padding: '12px 16px', display: 'flex', gap: 6, background: 'var(--surface-2)' }}>
        <Block height={32} />
        <Block height={32} width="62%" />
      </div>
    </div>
  )
}

function PanelSectionShadow({ rows }: { rows: number }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
      <Block width={92} height={10} style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Block width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
            <Block width={i % 2 ? '62%' : '78%'} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FormPanelShadow({ rows, style }: { rows: number; style?: CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 18, ...style }}>
      <Block width={168} height={15} />
      <Block width="54%" height={11} style={{ marginTop: 8, marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 14, alignItems: 'center' }}>
            <Block width={i % 2 ? 92 : 118} height={11} />
            <Block height={34} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({ rows, chart = false, style }: { rows: number; chart?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 14, minHeight: 0, ...style }}>
      <Block width="34%" height={13} />
      {chart && <Block height={220} style={{ marginTop: 18 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px', gap: 12, alignItems: 'center' }}>
            <Block height={12} width={i % 3 === 0 ? '76%' : i % 3 === 1 ? '58%' : '88%'} />
            <Block height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

const CUST_COLS = '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr'

function CustomersSkeleton() {
  return (
    <div style={{ height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Block width={150} height={28} />
            <Block width={250} height={13} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Block width={152} height={40} style={{ borderRadius: 10 }} />
            <Block width={140} height={40} style={{ borderRadius: 10 }} />
          </div>
        </div>
        {/* 4 KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Block width={i % 2 ? 84 : 108} height={11} />
                <Block width={16} height={16} style={{ borderRadius: 5 }} />
              </div>
              <Block width={i % 2 ? 70 : 96} height={26} style={{ marginTop: 15 }} />
              <Block width="52%" height={10} style={{ marginTop: 11 }} />
            </div>
          ))}
        </div>
        {/* search + sort */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <Block height={40} style={{ flex: 1, borderRadius: 10 }} />
          <Block width={150} height={40} style={{ borderRadius: 10 }} />
        </div>
        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[54, 96, 92, 138, 66].map((w, i) => <Block key={i} width={w} height={34} style={{ borderRadius: 999 }} />)}
        </div>
        {/* table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: CUST_COLS, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
            {Array.from({ length: 7 }).map((_, i) => <Block key={i} width={i === 0 ? 60 : i % 2 ? 52 : 72} height={10} />)}
          </div>
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: CUST_COLS, gap: 12, padding: '14px 20px', borderBottom: r === 5 ? 'none' : '1px solid var(--divider)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Block width={38} height={38} style={{ borderRadius: 999, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Block width={116} height={13} />
                  <Block width={72} height={10} />
                </div>
              </div>
              <Block width={124} height={12} />
              <Block width={64} height={20} style={{ borderRadius: 999 }} />
              <Block width={22} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={58} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={46} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={66} height={12} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardRouteSkeleton({ kind = 'pano' }: Props) {
  const content: Record<SkeletonKind, ReactNode> = {
    pano: <PanoSkeleton />,
    analytics: <AnalyticsSkeleton />,
    orders: <OrdersSkeleton />,
    menu: <MenuSkeleton />,
    theme: <ThemeSkeleton />,
    tables: <TablesSkeleton />,
    settings: <SettingsSkeleton />,
    customers: <CustomersSkeleton />,
  }

  return (
    <div style={shell}>
      <TopBarSkeleton kind={kind} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {content[kind]}
      </div>
    </div>
  )
}
