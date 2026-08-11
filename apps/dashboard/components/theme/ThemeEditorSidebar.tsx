'use client'

import type { ReactNode, RefObject } from 'react'
import { getSectionDefinitionId, getSectionVisibility } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import { getCategoryParentId, pageBlockKey, type MenuCategory, type PageBlock } from './theme-page-flow-model'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, XIcon } from 'lucide-react'

type EditorNavGroup = {
  title: string
  items: Array<{
    id: string
    label: string
    sub: string
    icon: ReactNode
    parentLabel?: string
    depth?: number
  }>
}

type SectionLibraryItem = {
  id: string
  label: string
  sub: string
}

interface ThemeEditorSidebarProps {
  width: number
  templateName: string
  editorSearch: string
  editorQuery: string
  navGroups: EditorNavGroup[]
  activeGroup: string
  pageBlocks: PageBlock[]
  visiblePageBlocks: PageBlock[]
  menuCategories: MenuCategory[]
  sectionLibrary: readonly SectionLibraryItem[]
  selectedSectionId: string | null
  dragBlockKey: string | null
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  onEditorSearchChange: (value: string) => void
  onSelectGroup: (groupId: string) => void
  onSelectPageBlock: (block: PageBlock) => void
  onDragStart: (key: string) => void
  onDragEnd: () => void
  onDrop: (targetKey: string) => void
  onMove: (sourceKey: string, direction: -1 | 1) => void
  onRemoveSection: (sectionId: string) => void
  onOpenSectionPicker: () => void
}

export function ThemeEditorSidebar({
  width,
  templateName,
  editorSearch,
  editorQuery,
  navGroups,
  activeGroup,
  pageBlocks,
  visiblePageBlocks,
  menuCategories,
  sectionLibrary,
  selectedSectionId,
  dragBlockKey,
  sectionTriggerRef,
  onEditorSearchChange,
  onSelectGroup,
  onSelectPageBlock,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRemoveSection,
  onOpenSectionPicker,
}: ThemeEditorSidebarProps) {
  return (
    <aside aria-labelledby="theme-editor-page-heading" style={{
      width,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h2 id="theme-editor-page-heading" style={{ margin: 0, flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.25, color: 'var(--text)' }}>
            Tema araçları
          </h2>
          <Badge variant="positive">
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
            Canlı
          </Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>v2.4 · {templateName}</div>
      </div>

      <div style={{ padding: '12px 12px 6px' }}>
        <InputGroup>
          <InputGroupAddon><InputGroupText><I.search /></InputGroupText></InputGroupAddon>
          <InputGroupInput
            value={editorSearch}
            onChange={(event) => onEditorSearchChange(event.target.value)}
            placeholder="Bölümlerde ara"
            aria-label="Tema bölümlerinde ara"
          />
          <InputGroupAddon align="inline-end"><kbd className="text-xs text-muted-foreground">⌘K</kbd></InputGroupAddon>
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
      <div style={{ padding: '4px 8px 12px' }}>
        {navGroups.map((group, groupIndex) => (
          <div key={group.title} style={{ marginTop: groupIndex === 0 ? 8 : 18 }}>
            <h3 style={navGroupLabelStyle}>{group.title}</h3>
            {group.items.map((item, itemIndex) => (
              <div key={item.id}>
              {item.parentLabel && group.items[itemIndex - 1]?.parentLabel !== item.parentLabel && (
                <div style={{ margin: '5px 10px 4px', fontSize: 12.5, fontWeight: 750, color: 'var(--text)' }}>
                  {item.parentLabel}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelectGroup(item.id)}
                className={cn('h-auto min-h-12 w-full justify-start gap-2.5 px-2.5 py-2 text-left text-muted-foreground', item.depth && 'pl-5.5', activeGroup === item.id && 'bg-muted text-foreground')}
              >
                <span style={{ display: 'inline-flex', color: activeGroup === item.id ? 'var(--text)' : 'var(--text-3)' }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{item.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                    {item.sub}
                  </span>
                </span>
                {activeGroup === item.id && <I.chevRight size={17} />}
              </Button>
              </div>
            ))}
          </div>
        ))}

        {visiblePageBlocks.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 style={navGroupLabelStyle}>Sayfa Akışı</h3>
            {editorQuery && (
              <Alert role="note" className="mx-2 mb-2"><AlertDescription>
                Arama sırasında sıralama kapalıdır. Taşımak için aramayı temizleyin.
              </AlertDescription></Alert>
            )}
            {[...visiblePageBlocks.filter((block) => block.placement !== 'drawer'), ...visiblePageBlocks.filter((block) => block.placement === 'drawer')].map((block, blockIndex, orderedBlocks) => {
              const key = pageBlockKey(block)
              const sectionDefinitionId = getSectionDefinitionId(block)
              const preset = block.type === 'section'
                ? sectionLibrary.find((item) => item.id === sectionDefinitionId)
                : null
              const category = block.type === 'category'
                ? menuCategories.find((item) => item.id === block.id)
                : null
              const categoryParentId = block.type === 'category'
                ? getCategoryParentId(menuCategories, block.id)
                : null
              const isChildCategory = Boolean(categoryParentId)
              const isDrawerSection = block.type === 'section' && block.placement === 'drawer'
              const startsDrawerGroup = isDrawerSection && orderedBlocks[blockIndex - 1]?.placement !== 'drawer'
              const selected = block.type === 'section' && selectedSectionId === block.id
              const label = block.type === 'section'
                ? preset?.label ?? sectionDefinitionId ?? block.id
                : block.type === 'nav'
                  ? 'Kategori Menüsü'
                  : category?.name ?? block.id
              const description = block.type === 'section'
                ? `${isDrawerSection ? 'Menü Drawer' : getSectionScopeLabel(block)} · ${preset?.sub ?? 'Özel bölüm'}`
                : block.type === 'nav'
                  ? 'Kaydırılabilir kategori navigasyonu'
                  : isChildCategory
                    ? `${menuCategories.find((item) => item.id === categoryParentId)?.name ?? 'Üst kategori'} alt kategorisi`
                    : 'Menü kategorisi'

              return (
                <div key={key}>
                {startsDrawerGroup && <h3 style={{ ...navGroupLabelStyle, marginTop: 16 }}>Menü Çekmecesi İçeriği</h3>}
                <Item
                  data-page-flow-row
                  data-drawer-flow-row={isDrawerSection || undefined}
                  role="group"
                  aria-label={`${label} akış öğesi`}
                  draggable={!editorQuery}
                  onDragStart={() => onDragStart(key)}
                  onDragEnd={onDragEnd}
                  onDragOver={(event) => { if (!editorQuery) event.preventDefault() }}
                  onDrop={() => onDrop(key)}
                  variant={selected ? 'muted' : 'default'}
                  size="xs"
                  className={cn('relative min-h-10 flex-nowrap gap-1.5', selected ? 'text-foreground' : 'text-muted-foreground')}
                  style={{
                    padding: isChildCategory ? '5px 6px 5px 28px' : isDrawerSection ? '5px 6px 5px 18px' : '5px 6px',
                    cursor: editorQuery ? 'default' : dragBlockKey === key ? 'grabbing' : 'grab',
                    opacity: dragBlockKey === key ? 0.55 : 1,
                  }}
                >
                  {isChildCategory && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 13,
                        top: -8,
                        bottom: 14,
                        width: 10,
                        borderLeft: '1px solid var(--border-strong)',
                        borderBottom: '1px solid var(--border-strong)',
                        borderBottomLeftRadius: 6,
                      }}
                    />
                  )}
                  <ItemMedia data-page-flow-drag-handle variant="icon" aria-hidden className="shrink-0">
                    <GripVerticalIcon />
                  </ItemMedia>
                  <Button
                    data-page-flow-select
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPageBlock(block)}
                    className="h-auto min-w-0 flex-1 justify-start gap-1.5 overflow-hidden p-0 text-left hover:bg-transparent"
                    style={{
                      color: 'inherit',
                    }}
                  >
                    <ItemMedia variant="icon" style={{ color: selected ? 'var(--text)' : 'var(--text-3)' }}>
                      {block.type === 'section'
                        ? <I.page size={17} />
                        : block.type === 'nav'
                          ? <I.header size={17} />
                          : <I.section size={17} />}
                    </ItemMedia>
                    <ItemContent data-page-flow-content className="min-w-0 items-start gap-0">
                      <ItemTitle className="w-full truncate" title={label}>{label}</ItemTitle>
                      <ItemDescription className="w-full truncate" title={description}>
                        {description}
                      </ItemDescription>
                    </ItemContent>
                  </Button>
                  <ItemActions data-page-flow-actions className="shrink-0 gap-0.5">
                    {!editorQuery && (
                      <ButtonGroup aria-label={`${label} sıralaması`} className="shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`${label} öğesini yukarı taşı`}
                          disabled={pageBlocks[0] === block}
                          onClick={() => onMove(key, -1)}
                        >
                          <ArrowUpIcon data-icon="inline-start" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`${label} öğesini aşağı taşı`}
                          disabled={pageBlocks[pageBlocks.length - 1] === block}
                          onClick={() => onMove(key, 1)}
                        >
                          <ArrowDownIcon data-icon="inline-start" />
                        </Button>
                      </ButtonGroup>
                    )}
                    {block.type === 'section' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`${label} bölümünü kaldır`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemoveSection(block.id)
                        }}
                      >
                        <XIcon data-icon="inline-start" />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
                </div>
              )
            })}
          </div>
        )}

        <div data-page-flow-add className="relative px-1 pb-1 pt-3">
          <Button
            ref={sectionTriggerRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSectionPicker}
            className="w-full border-dashed"
          >
            <I.plus data-icon="inline-start" />
            Bölüm ekle
          </Button>
        </div>
      </div>
      </ScrollArea>
    </aside>
  )
}

function getSectionScopeLabel(block: PageBlock) {
  const visibility = getSectionVisibility(block)
  if (visibility.mode === 'home') return 'Ana ekranda'
  if (visibility.mode === 'categories') {
    const count = visibility.categoryIds?.length ?? 0
    return count > 0 ? `${count} kategoride` : 'Kategori seçilmedi'
  }
  return 'Tüm menüde'
}

const navGroupLabelStyle = {
  margin: 0,
  padding: '0 10px 7px',
  color: 'var(--text-4)',
  fontSize: 10.5,
  fontWeight: 750,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
} as const
