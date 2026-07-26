'use client'

import type { ReactNode, RefObject } from 'react'
import { getSectionDefinitionId, getSectionVisibility } from '@garsonless/design-engine'
import { I } from '../../lib/ui'
import { getCategoryParentId, pageBlockKey, type MenuCategory, type PageBlock } from './theme-page-flow-model'

type EditorNavGroup = {
  title: string
  items: Array<{
    id: string
    label: string
    sub: string
    icon: ReactNode
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
    <aside style={{
      width,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            Tema Düzenleyici
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 650,
            color: 'var(--positive)',
            background: 'var(--positive-bg)',
            borderRadius: 999,
            padding: '3px 8px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
            Canlı
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>v2.4 · {templateName}</div>
      </div>

      <div style={{ padding: '12px 12px 6px' }}>
        <div style={{
          height: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          background: 'var(--surface-3)',
          borderRadius: 8,
          color: 'var(--text-3)',
        }}>
          <I.search size={17} />
          <input
            value={editorSearch}
            onChange={(event) => onEditorSearchChange(event.target.value)}
            placeholder="Bölümlerde ara"
            aria-label="Tema bölümlerinde ara"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 12.5,
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-4)' }}>⌘K</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 12px' }}>
        {navGroups.map((group, groupIndex) => (
          <div key={group.title} style={{ marginTop: groupIndex === 0 ? 8 : 18 }}>
            <div style={navGroupLabelStyle}>{group.title}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectGroup(item.id)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 8,
                  background: activeGroup === item.id ? 'var(--surface-inset)' : 'transparent',
                  color: activeGroup === item.id ? 'var(--text)' : 'var(--text-2)',
                  cursor: 'pointer',
                }}
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
              </button>
            ))}
          </div>
        ))}

        {visiblePageBlocks.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={navGroupLabelStyle}>Sayfa Akışı</div>
            {editorQuery && (
              <div role="note" style={{ margin: '0 8px 8px', fontSize: 11, lineHeight: 1.4, color: 'var(--text-3)' }}>
                Arama sırasında sıralama kapalıdır. Taşımak için aramayı temizleyin.
              </div>
            )}
            {visiblePageBlocks.map((block) => {
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
              const selected = block.type === 'section' && selectedSectionId === block.id
              const label = block.type === 'section'
                ? preset?.label ?? sectionDefinitionId ?? block.id
                : block.type === 'nav'
                  ? 'Kategori Menüsü'
                  : category?.name ?? block.id

              return (
                <div
                  key={key}
                  data-page-flow-row
                  role="group"
                  aria-label={`${label} akış öğesi`}
                  draggable={!editorQuery}
                  onDragStart={() => onDragStart(key)}
                  onDragEnd={onDragEnd}
                  onDragOver={(event) => { if (!editorQuery) event.preventDefault() }}
                  onDrop={() => onDrop(key)}
                  style={{
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: isChildCategory ? '6px 10px 6px 34px' : '7px 10px',
                    borderRadius: 8,
                    background: selected ? 'var(--surface-inset)' : 'transparent',
                    color: selected ? 'var(--text)' : 'var(--text-2)',
                    cursor: editorQuery ? 'default' : dragBlockKey === key ? 'grabbing' : 'grab',
                    opacity: dragBlockKey === key ? 0.55 : 1,
                    position: 'relative',
                    outline: 'none',
                  }}
                >
                  {isChildCategory && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 17,
                        top: -8,
                        bottom: 18,
                        width: 14,
                        borderLeft: '1px solid var(--border-strong)',
                        borderBottom: '1px solid var(--border-strong)',
                        borderBottomLeftRadius: 6,
                      }}
                    />
                  )}
                  <span aria-hidden style={{ color: 'var(--text-4)', fontSize: 13, letterSpacing: -2 }}>⋮⋮</span>
                  <button
                    data-page-flow-select
                    type="button"
                    onClick={() => onSelectPageBlock(block)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', color: selected ? 'var(--text)' : 'var(--text-3)' }}>
                      {block.type === 'section'
                        ? <I.page size={17} />
                        : block.type === 'nav'
                          ? <I.header size={17} />
                          : <I.section size={17} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                        {block.type === 'section'
                          ? `${getSectionScopeLabel(block)} · ${preset?.sub ?? 'Özel bölüm'}`
                          : block.type === 'nav'
                            ? 'Kaydırılabilir kategori navigasyonu'
                            : isChildCategory
                              ? `${menuCategories.find((item) => item.id === categoryParentId)?.name ?? 'Üst kategori'} alt kategorisi`
                              : 'Menü kategorisi'}
                      </span>
                    </span>
                  </button>
                  {!editorQuery && (
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      <button
                        type="button"
                        aria-label="Yukarı taşı"
                        disabled={pageBlocks[0] === block}
                        onClick={() => onMove(key, -1)}
                        style={moveButtonStyle}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Aşağı taşı"
                        disabled={pageBlocks[pageBlocks.length - 1] === block}
                        onClick={() => onMove(key, 1)}
                        style={moveButtonStyle}
                      >
                        ↓
                      </button>
                    </span>
                  )}
                  {block.type === 'section' && (
                    <button
                      type="button"
                      aria-label="Bölümü kaldır"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveSection(block.id)
                      }}
                      style={moveButtonStyle}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ position: 'relative', marginTop: 14 }}>
          <button
            ref={sectionTriggerRef}
            type="button"
            onClick={onOpenSectionPicker}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              height: 36,
              border: '1px dashed var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-2)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <I.plus size={17} />
            Bölüm ekle
          </button>
        </div>
      </div>
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
  padding: '0 10px 7px',
  color: 'var(--text-4)',
  fontSize: 10.5,
  fontWeight: 750,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
} as const

const moveButtonStyle = {
  width: 24,
  height: 24,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text-3)',
  cursor: 'pointer',
} as const
