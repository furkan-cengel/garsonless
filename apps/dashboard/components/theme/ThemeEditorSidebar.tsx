'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { getSectionDefinitionId, getSectionVisibility } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import { getCategoryParentId, getKeyboardMoveTarget, pageBlockKey, type MenuCategory, type PageBlock } from './theme-page-flow-model'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ArrowDownIcon, ArrowUpIcon, EllipsisVerticalIcon, GripVerticalIcon, LockKeyholeIcon, Trash2Icon } from 'lucide-react'

type EditorNavGroup = {
  title: string
  items: Array<{
    id: string
    label: string
    sub: string
    icon: ReactNode
    parentLabel?: string
    depth?: number
    locked?: boolean
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
  selectedPageBlockKey: string | null
  pageFlowStatus: string
  dragBlockKey: string | null
  sectionTriggerRef: RefObject<HTMLButtonElement | null>
  onEditorSearchChange: (value: string) => void
  onSelectGroup: (groupId: string) => void
  onSelectLockedGroup: (groupId: string) => void
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
  selectedPageBlockKey,
  pageFlowStatus,
  dragBlockKey,
  sectionTriggerRef,
  onEditorSearchChange,
  onSelectGroup,
  onSelectLockedGroup,
  onSelectPageBlock,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRemoveSection,
  onOpenSectionPicker,
}: ThemeEditorSidebarProps) {
  const [pendingRemoval, setPendingRemoval] = useState<{ block: PageBlock; label: string; fallbackKey: string | null } | null>(null)
  const [canPointerDrag, setCanPointerDrag] = useState(false)
  const actionTriggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const orderedBlocks = useMemo(() => [
    ...visiblePageBlocks.filter((block) => block.placement !== 'drawer'),
    ...visiblePageBlocks.filter((block) => block.placement === 'drawer'),
  ], [visiblePageBlocks])
  const mainBlocks = orderedBlocks.filter((block) => block.placement !== 'drawer')
  const drawerBlocks = orderedBlocks.filter((block) => block.placement === 'drawer')

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setCanPointerDrag(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const sectionLabel = (block: PageBlock, fallback: string) => {
    if (block.type !== 'section') return fallback
    const definitionId = getSectionDefinitionId(block)
    const siblings = pageBlocks.filter((candidate) =>
      candidate.type === 'section' && getSectionDefinitionId(candidate) === definitionId,
    )
    if (siblings.length < 2) return fallback
    const ordinal = siblings.findIndex((candidate) => candidate.id === block.id) + 1
    return ordinal > 1 ? `${fallback} ${ordinal}` : fallback
  }

  const getBlockCopy = (block: PageBlock) => {
    const definitionId = getSectionDefinitionId(block)
    const preset = block.type === 'section'
      ? sectionLibrary.find((item) => item.id === definitionId)
      : null
    const category = block.type === 'category'
      ? menuCategories.find((item) => item.id === block.id)
      : null
    const parentId = block.type === 'category'
      ? getCategoryParentId(menuCategories, block.id)
      : null
    const drawer = block.type === 'section' && block.placement === 'drawer'
    const baseLabel = block.type === 'section'
      ? preset?.label ?? definitionId ?? block.id
      : block.type === 'nav'
        ? 'Kategori Menüsü'
        : category?.name ?? block.id
    return {
      label: sectionLabel(block, baseLabel),
      description: block.type === 'section'
        ? `${drawer ? 'Menü Drawer' : getSectionScopeLabel(block)} · ${preset?.sub ?? 'Özel bölüm'}`
        : block.type === 'nav'
          ? 'Kaydırılabilir kategori navigasyonu'
          : parentId
            ? `${menuCategories.find((item) => item.id === parentId)?.name ?? 'Üst kategori'} alt kategorisi`
            : 'Menü kategorisi',
    }
  }

  const askToRemove = (block: PageBlock, label: string) => {
    const index = orderedBlocks.findIndex((candidate) => pageBlockKey(candidate) === pageBlockKey(block))
    const fallback = orderedBlocks[index + 1] ?? orderedBlocks[index - 1]
    setPendingRemoval({ block, label, fallbackKey: fallback ? pageBlockKey(fallback) : null })
  }

  const removePendingSection = () => {
    if (!pendingRemoval || pendingRemoval.block.type !== 'section') return
    const { block, fallbackKey } = pendingRemoval
    setPendingRemoval(null)
    onRemoveSection(block.id)
    requestAnimationFrame(() => {
      if (fallbackKey) actionTriggerRefs.current.get(fallbackKey)?.focus()
      else sectionTriggerRef.current?.focus()
    })
  }

  const renderRow = (block: PageBlock, child = false) => {
    const key = pageBlockKey(block)
    const { label, description } = getBlockCopy(block)
    const selected = selectedPageBlockKey === key || (block.type === 'section' && selectedSectionId === block.id)
    const upTarget = getKeyboardMoveTarget(pageBlocks, menuCategories, key, -1)
    const downTarget = getKeyboardMoveTarget(pageBlocks, menuCategories, key, 1)
    return (
      <Item
        data-page-flow-row
        data-drawer-flow-row={block.placement === 'drawer' || undefined}
        role="group"
        aria-label={`${label} akış öğesi`}
        onDragOver={(event) => { if (!editorQuery && canPointerDrag) event.preventDefault() }}
        onDrop={() => onDrop(key)}
        variant={selected ? 'muted' : 'default'}
        size="xs"
        className={cn('relative min-h-12 flex-nowrap gap-1 has-[[data-page-flow-select]:focus-visible]:border-ring has-[[data-page-flow-select]:focus-visible]:bg-muted', selected ? 'text-foreground' : 'text-muted-foreground')}
        style={{
          padding: child ? '2px 2px 2px 8px' : block.placement === 'drawer' ? '2px 2px 2px 10px' : '2px',
          opacity: dragBlockKey === key ? 0.55 : 1,
        }}
      >
        <span
          data-page-flow-drag-handle
          aria-label={`${label} öğesini sürükleyerek taşı`}
          role="img"
          draggable={!editorQuery && canPointerDrag}
          onDragStart={() => onDragStart(key)}
          onDragEnd={onDragEnd}
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground', canPointerDrag && !editorQuery ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')}
        >
          <GripVerticalIcon size={17} aria-hidden />
        </span>
        <Tooltip>
          <TooltipTrigger render={<Button
            data-page-flow-select
            type="button"
            variant="ghost"
            aria-current={selected ? 'location' : undefined}
            onClick={() => onSelectPageBlock(block)}
            className="min-h-11 min-w-0 flex-1 justify-start gap-1.5 overflow-hidden p-0 text-left hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
            style={{ color: 'inherit' }}
          />}>
            <ItemMedia variant="icon" style={{ color: selected ? 'var(--text)' : 'var(--text-3)' }}>
              {block.type === 'section'
                ? <I.page size={17} />
                : block.type === 'nav'
                  ? <I.header size={17} />
                  : <I.section size={17} />}
            </ItemMedia>
            <ItemContent data-page-flow-content className="min-w-0 items-start gap-0">
              <ItemTitle className="w-full truncate">{label}</ItemTitle>
              <ItemDescription className="w-full truncate">{description}</ItemDescription>
            </ItemContent>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} align="center" className="max-w-64 whitespace-normal text-[11px] leading-snug">
            <strong className="block text-foreground">{label}</strong>
            <span>{description}</span>
          </TooltipContent>
        </Tooltip>
        <ItemActions data-page-flow-actions className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${label} öğe işlemleri`}
              render={<Button
                ref={(node) => {
                  if (node) actionTriggerRefs.current.set(key, node)
                  else actionTriggerRefs.current.delete(key)
                }}
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
              />}
            >
              <EllipsisVerticalIcon size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label={`${label} işlemleri`}>
              <DropdownMenuGroup>
                <DropdownMenuItem className="min-h-11" disabled={!upTarget || Boolean(editorQuery)} onClick={() => onMove(key, -1)}>
                  <ArrowUpIcon />Yukarı taşı
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-11" disabled={!downTarget || Boolean(editorQuery)} onClick={() => onMove(key, 1)}>
                  <ArrowDownIcon />Aşağı taşı
                </DropdownMenuItem>
                {block.type === 'section' && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="min-h-11" variant="destructive" onClick={() => askToRemove(block, label)}>
                    <Trash2Icon />Bölümü kaldır
                  </DropdownMenuItem>
                </>}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>
    )
  }

  const renderFlowList = (blocks: PageBlock[], label: string) => {
    const topLevel = blocks.filter((block) => block.type !== 'category' || !getCategoryParentId(menuCategories, block.id))
    return <ol aria-label={label} className="m-0 list-none p-0">
      {topLevel.map((block) => {
        const children = block.type === 'category'
          ? blocks.filter((candidate) => candidate.type === 'category' && getCategoryParentId(menuCategories, candidate.id) === block.id)
          : []
        return <li key={pageBlockKey(block)}>
          {renderRow(block)}
          {children.length > 0 && <ol aria-label={`${getBlockCopy(block).label} alt kategorileri`} className="ml-5 list-none border-l border-border pl-1">
            {children.map((child) => <li key={pageBlockKey(child)}>{renderRow(child, true)}</li>)}
          </ol>}
        </li>
      })}
    </ol>
  }

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

      <ScrollArea data-theme-editor-scroll="page" className="min-h-0 flex-1">
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
                onClick={() => item.locked ? onSelectLockedGroup(item.id) : onSelectGroup(item.id)}
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
                {item.locked
                  ? <Badge variant="secondary" className="gap-1"><LockKeyholeIcon size={12} />Pro</Badge>
                  : activeGroup === item.id && <I.chevRight size={17} />}
              </Button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 18 }}>
          <h3 style={navGroupLabelStyle}>Sayfa Akışı</h3>
          {editorQuery && (
            <Alert role="note" className="mx-2 mb-2"><AlertDescription>
              Arama sırasında sıralama kapalıdır. Taşımak için aramayı temizleyin.
            </AlertDescription></Alert>
          )}
          {mainBlocks.length > 0
            ? renderFlowList(mainBlocks, 'Ana sayfa akışı')
            : <p role="status" className="mx-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                {editorQuery ? 'Sayfa akışında eşleşme bulunamadı.' : 'Sayfa akışı henüz boş.'}
              </p>}
          {drawerBlocks.length > 0 && <>
            <h3 style={{ ...navGroupLabelStyle, marginTop: 16 }}>Menü Çekmecesi İçeriği</h3>
            {renderFlowList(drawerBlocks, 'Menü Drawer akışı')}
          </>}
        </div>

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{pageFlowStatus}</div>

        <div data-page-flow-add className="relative px-1 pb-1 pt-3">
          <Button
            ref={sectionTriggerRef}
            type="button"
            variant="outline"
            size="default"
            onClick={onOpenSectionPicker}
            className="min-h-11 w-full border-dashed"
          >
            <I.plus data-icon="inline-start" />
            Bölüm ekle
          </Button>
        </div>
      </div>
      </ScrollArea>
      <AlertDialog open={Boolean(pendingRemoval)} onOpenChange={(open) => { if (!open) setPendingRemoval(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingRemoval?.label ?? 'Bölüm'} kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Bölüm ve bu örneğe ait ayarlar sayfa akışından kaldırılacak. Gerekirse üst çubuktaki Geri Al ile işlemi geri alabilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" variant="destructive" onClick={removePendingSection}>Bölümü kaldır</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
