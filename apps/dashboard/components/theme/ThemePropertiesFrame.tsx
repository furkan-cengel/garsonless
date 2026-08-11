'use client'

import type { ReactNode } from 'react'

import type { EditorTab } from './theme-editor-properties-model'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    <aside aria-labelledby="theme-editor-properties-heading" data-theme-property-density="compact" style={{
      width,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px 9px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h2 id="theme-editor-properties-heading" style={{ margin: 0, fontWeight: 700, fontSize: 14, lineHeight: 1.25, color: 'var(--text)' }}>{title}</h2>
            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 2, color: 'var(--text-3)' }}>{headerActions}</div>
        </div>
      </div>

      {tabs.length > 0 && (
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as EditorTab)} className="gap-0 border-b px-2.5">
          <TabsList variant="line" aria-label={`${title} ayar sekmeleri`}>
            {tabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      <ScrollArea data-theme-properties className="min-h-0 min-w-0 flex-1">
        {children}
      </ScrollArea>

      <div style={{
        minHeight: 36,
        borderTop: '1px solid var(--divider)',
        background: 'var(--surface-2)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={onReset}
        >
          Varsayılana sıfırla
        </Button>
        <Badge variant="outline" aria-live="polite">
          {propertyCount} özellik
        </Badge>
      </div>
    </aside>
  )
}
