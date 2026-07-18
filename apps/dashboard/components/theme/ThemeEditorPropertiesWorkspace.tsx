'use client'

import type { ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { SettingField, SettingsGroup } from '@garsonless/ui'
import { I } from '../../lib/ui'
import { ThemePropertiesFrame } from './ThemePropertiesFrame'
import {
  AnnouncementPropertyPanel,
  CardPropertyPanel,
  CartPropertyPanel,
  HeaderPropertyPanel,
  LayoutPropertyPanel,
  NavPropertyPanel,
  PropertyFieldEditor,
  PropertySection,
  ThemePropertyPanel,
} from './ThemePropertyPanels'
import { SectionSettingsEditor } from './ThemeSectionSettings'
import {
  EDITOR_TABS,
  THEME_EDITOR_THEME_GROUP_ID,
  type EditorTab,
  type SectionSettingField,
} from './theme-editor-properties-model'

interface ThemeEditorPropertiesWorkspaceProps {
  width: number
  activeGroup: string
  activeGroupData?: SettingsGroup
  selectedSection?: { label: string; sub: string } | null
  selectedSectionId: string | null
  selectedSectionSettings: Record<string, string>
  visibleEditorTabs: Array<{ id: EditorTab; label: string }>
  effectiveEditorTab: EditorTab
  visibleFields: SettingField[]
  visibleSectionFields: SectionSettingField[]
  mergedTheme: GarsonlessTheme
  overrides: Partial<GarsonlessTheme>
  defaults: GarsonlessTheme
  schema: SettingsGroup[]
  menuCategories: Array<{ id: string; name: string }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
  menuHref: string
  logoCard?: ReactNode
  galleryPanel?: ReactNode
  onTabChange: (tab: EditorTab) => void
  onReset: () => void
  onCopy: () => void
  onFieldChange: (field: SettingField, value: unknown) => void
  onPatch: (patch: Partial<GarsonlessTheme>) => void
  onSectionSettingChange: (key: string, value: string) => void
}

export function ThemeEditorPropertiesWorkspace({
  width,
  activeGroup,
  activeGroupData,
  selectedSection,
  selectedSectionId,
  selectedSectionSettings,
  visibleEditorTabs,
  effectiveEditorTab,
  visibleFields,
  visibleSectionFields,
  mergedTheme,
  overrides,
  defaults,
  schema,
  menuCategories,
  menuItems,
  menuHref,
  logoCard,
  galleryPanel,
  onTabChange,
  onReset,
  onCopy,
  onFieldChange,
  onPatch,
  onSectionSettingChange,
}: ThemeEditorPropertiesWorkspaceProps) {
  const getValue = (field: SettingField) =>
    overrides[field.themeField] ?? defaults[field.themeField]

  return (
    <ThemePropertiesFrame
      width={width}
      title={selectedSection?.label ?? activeGroupData?.label ?? 'Sayfa'}
      subtitle={selectedSection?.sub ?? getGroupHint(activeGroupData?.id)}
      tabs={visibleEditorTabs}
      activeTab={effectiveEditorTab}
      onTabChange={onTabChange}
      propertyCount={selectedSection ? visibleSectionFields.length : visibleFields.length}
      onReset={onReset}
      headerActions={
        <>
          <IconButton title="Ayarları kopyala" onClick={onCopy}><I.copy size={17} /></IconButton>
          <IconButton title="Varsayılana sıfırla" onClick={onReset}><I.history size={17} /></IconButton>
        </>
      }
    >
      {selectedSection && selectedSectionId ? (
        <>
          <PropertySection title="Bölüm İçeriği" defaultOpen>
            {galleryPanel}
            {visibleSectionFields.length > 0 ? (
              <SectionSettingsEditor
                fields={visibleSectionFields}
                values={selectedSectionSettings}
                menuCategories={menuCategories}
                menuItems={menuItems}
                menuHref={menuHref}
                onChange={onSectionSettingChange}
              />
            ) : (
              <EmptySettingsMessage
                label={selectedSection.label}
                tab={effectiveEditorTab}
              />
            )}
          </PropertySection>
          <PropertySection title="Bölüm Davranışı" defaultOpen={false}>
            <div style={messageStyle}>
              Bölümü sol panelde tutup sürükleyerek sırasını değiştirebilirsin. Sıra anında önizlemeye gönderilir.
            </div>
          </PropertySection>
        </>
      ) : (
        <>
          <PropertySection title={activeGroupData?.label ?? 'Ayarlar'} defaultOpen>
            {logoCard}
            {activeGroup === 'header' && visibleFields.length > 0 ? (
              <HeaderPropertyPanel fields={visibleFields} getValue={getValue} onChange={onFieldChange} />
            ) : activeGroup === 'cards' && visibleFields.length > 0 ? (
              <CardPropertyPanel fields={visibleFields} layout={mergedTheme.cardLayout} getValue={getValue} onChange={onFieldChange} />
            ) : activeGroup === 'nav' && visibleFields.length > 0 ? (
              <NavPropertyPanel fields={visibleFields} visual={mergedTheme.catnavStyle === 'visual'} getValue={getValue} onChange={onFieldChange} />
            ) : activeGroup === 'layout' && visibleFields.length > 0 ? (
              <LayoutPropertyPanel fields={visibleFields} texture={mergedTheme.texture} getValue={getValue} onChange={onFieldChange} />
            ) : activeGroup === THEME_EDITOR_THEME_GROUP_ID && visibleFields.length > 0 ? (
              <ThemePropertyPanel fields={visibleFields} getValue={getValue} onChange={onFieldChange} />
            ) : activeGroup === 'cart' && visibleFields.length > 0 ? (
              <CartPropertyPanel
                fields={visibleFields}
                headerStyle={mergedTheme.cartHeaderTriggerStyle ?? 'none'}
                footerStyle={mergedTheme.cartFooterTriggerStyle ?? 'pill'}
                getValue={getValue}
                onChange={onFieldChange}
                onPatch={onPatch}
              />
            ) : activeGroup === 'announcement' && visibleFields.length > 0 ? (
              <AnnouncementPropertyPanel fields={visibleFields} getValue={getValue} onChange={onFieldChange} />
            ) : visibleFields.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleFields.map((field) => (
                  <PropertyFieldEditor
                    key={field.id}
                    field={field}
                    value={getValue(field)}
                    onChange={(value) => onFieldChange(field, value)}
                  />
                ))}
              </div>
            ) : (
              <EmptySettingsMessage
                label={activeGroupData?.label ?? 'Bu bölüm'}
                tab={effectiveEditorTab}
              />
            )}
          </PropertySection>
          {effectiveEditorTab === 'design' && activeGroup !== THEME_EDITOR_THEME_GROUP_ID && activeGroup !== 'announcement' && (
            <PropertySection title="Marka rengi" defaultOpen={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['accent', 'cta'].map((key) => {
                  const field = schema.flatMap((group) => group.fields).find((candidate) => candidate.themeField === key)
                  if (!field) return null
                  return (
                    <PropertyFieldEditor
                      key={field.id}
                      field={field}
                      value={getValue(field)}
                      onChange={(value) => onFieldChange(field, value)}
                    />
                  )
                })}
              </div>
            </PropertySection>
          )}
        </>
      )}
    </ThemePropertiesFrame>
  )
}

function EmptySettingsMessage({ label, tab }: { label: string; tab: EditorTab }) {
  return (
    <div style={messageStyle}>
      {label} için {EDITOR_TABS.find((candidate) => candidate.id === tab)?.label.toLowerCase()} sekmesinde ayar yok.
    </div>
  )
}

function getGroupHint(id?: string) {
  if (!id) return 'Tüm sayfalara uygulanır'
  if (id === THEME_EDITOR_THEME_GROUP_ID) return 'Renkler ve yazı sistemi'
  if (id.includes('surface')) return 'Tüm sayfalara uygulanır'
  if (id.includes('topbar')) return 'Sayfa üstündeki marka alanı'
  if (id.includes('welcome')) return 'Karşılama bloğu'
  if (id.includes('menu')) return 'Kategori ve menü kartları'
  if (id.includes('dish')) return 'Tüm ürünlere uygulanır'
  if (id.includes('payment')) return 'Sepet ve ödeme akışı'
  return 'Bu tema bölümüne uygulanır'
}

function IconButton({ children, title, onClick }: {
  children: ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        color: 'var(--text-3)',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

const messageStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 8,
  background: 'var(--surface-3)',
  color: 'var(--text-3)',
  fontSize: 12.5,
  lineHeight: 1.45,
}
