'use client'

import type { ReactNode } from 'react'

import type { EditorTab } from './theme-editor-properties-model'

interface Props {
  title: string
  subtitle: string
  tabs: Array<{ id: EditorTab; label: string }>
  activeTab: EditorTab
  onTabChange: (tab: EditorTab) => void
  headerActions: ReactNode
  children: ReactNode
  propertyCount: number
  onReset: () => void
  width: number
}

export function ThemePropertiesFrame({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  children,
  propertyCount,
  onReset,
  width,
}: Props) {
  return (
    <aside style={{
      width,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</div>
            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 4, color: 'var(--text-3)' }}>{headerActions}</div>
        </div>
      </div>

      {tabs.length > 0 && (
        <div role="tablist" aria-label={`${title} ayar sekmeleri`} style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 12px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '11px 10px 10px',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--text)' : 'transparent'}`,
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-2)',
                fontSize: 12.5,
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div data-theme-properties style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </div>

      <div style={{
        minHeight: 44,
        borderTop: '1px solid var(--divider)',
        background: 'var(--surface-2)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-2)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Varsayılana sıfırla
        </button>
        <span aria-live="polite" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {propertyCount} özellik
        </span>
      </div>
    </aside>
  )
}
