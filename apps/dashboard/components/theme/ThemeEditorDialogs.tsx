'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { I } from '../../lib/ui'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'
import { VIDEO_HERO_SECTION_ID } from '@garsonless/design-engine'
import { ThemeSectionCatalogIcon, type ThemeSectionCatalogIconName } from './ThemeSectionCatalogIcon'

export type ThemeSectionOption = {
  id: string
  group: string
  label: string
  sub: string
  icon: ThemeSectionCatalogIconName
  plan: 'starter' | 'pro'
  status: 'ready' | 'planned'
  singleton?: boolean
  global?: boolean
}

function countSectionInstances(activeSectionIds: readonly string[], sectionId: string) {
  return activeSectionIds.filter((id) => id === sectionId || id.startsWith(`${sectionId}--`)).length
}

interface SectionPickerDialogProps {
  surface?: 'menu' | 'home'
  closeRef: RefObject<HTMLButtonElement | null>
  search: string
  activeGroup: string
  groups: readonly string[]
  sections: readonly ThemeSectionOption[]
  visibleSections: readonly ThemeSectionOption[]
  activeSectionIds: readonly string[]
  canAddAdvancedSections: boolean
  canUseVideoHero: boolean
  onSearchChange: (value: string) => void
  onGroupChange: (group: string) => void
  onAddSection: (sectionId: string) => void
  onLockedSection: () => void
  onClose: () => void
  renderPreview: (sectionId: string, compact?: boolean) => ReactNode
}

export function SectionPickerDialog({
  surface = 'menu',
  closeRef,
  search,
  activeGroup,
  groups,
  sections,
  visibleSections,
  activeSectionIds,
  canAddAdvancedSections,
  canUseVideoHero,
  onSearchChange,
  onGroupChange,
  onAddSection,
  onLockedSection,
  onClose,
  renderPreview,
}: SectionPickerDialogProps) {
  // Video Hero is billed separately from the bundled advanced catalogue, so it
  // unlocks on its own add-on rather than on `theme_advanced_sections`.
  const isSectionLocked = (section: ThemeSectionOption) => section.plan !== 'pro'
    ? false
    : section.id === VIDEO_HERO_SECTION_ID ? !canUseVideoHero : !canAddAdvancedSections
  const [selectedId, setSelectedId] = useState(() => visibleSections[0]?.id ?? sections[0]?.id ?? '')
  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? visibleSections[0] ?? null,
    [sections, selectedId, visibleSections],
  )

  useEffect(() => {
    if (visibleSections.some((section) => section.id === selectedId)) return
    setSelectedId(visibleSections[0]?.id ?? '')
  }, [selectedId, visibleSections])

  const selectedInstanceCount = selected
    ? countSectionInstances(activeSectionIds, selected.id)
    : 0
  const selectedExists = selectedInstanceCount > 0
  const selectedLocked = selected !== null && isSectionLocked(selected)
  const selectedPlanned = selected?.status === 'planned'
  const readyCount = sections.filter((section) => section.status === 'ready').length
  const plannedCount = sections.length - readyCount

  function handlePrimaryAction() {
    if (!selected) return
    if (selectedLocked) {
      onLockedSection()
      return
    }
    if (selectedPlanned) return
    onAddSection(selected.id)
  }

  const primaryDisabled = !selected || selectedPlanned
  const primaryLabel = selectedPlanned
    ? 'Geliştiriliyor'
    : selectedLocked
      ? 'Pro ile aç'
      : selected?.singleton && selectedExists
        ? selected.global ? 'Önizlemede göster' : 'Ayarları aç'
        : selectedExists
        ? 'Bir tane daha ekle'
        : 'Bölümü ekle'

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="section-picker-dialog max-w-none gap-0 p-0 sm:max-w-none"
        style={dialogStyle}
      >
        <style jsx global>{`
          .section-picker-close,
          .section-picker-search,
          .section-picker-chip,
          .section-picker-secondary,
          .section-picker-primary {
            min-height: 44px !important;
          }
          .section-picker-close { min-width: 44px !important; }
          @media (hover: hover) and (pointer: fine) {
            .section-picker-close:hover {
              background: var(--surface-3) !important;
              color: var(--text) !important;
            }
            .section-picker-chip:not([aria-pressed='true']):hover,
            .section-picker-secondary:hover {
              border-color: var(--text-3) !important;
              background: var(--surface-2) !important;
              color: var(--text) !important;
            }
            .section-picker-card-select:hover {
              background: transparent !important;
              color: inherit !important;
            }
            .section-picker-primary:not(:disabled):hover {
              filter: brightness(.92);
              transform: translateY(-1px);
            }
          }
          .section-picker-close:focus-visible,
          .section-picker-chip:focus-visible,
          .section-picker-secondary:focus-visible,
          .section-picker-primary:focus-visible,
          .section-picker-search:focus-within {
            outline: 2px solid var(--text);
            outline-offset: 2px;
          }
          @media (max-width: 900px) {
            .section-picker-dialog {
              width: min(620px, calc(100vw - 24px)) !important;
              height: min(760px, calc(100vh - 24px)) !important;
            }
            .section-picker-toolbar {
              align-items: stretch !important;
              flex-direction: column !important;
            }
            .section-picker-search {
              width: 100% !important;
              flex: 0 0 44px !important;
            }
            .section-picker-body {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .section-picker-detail {
              display: none !important;
            }
          }
          @media (max-width: 560px) {
            .section-picker-dialog {
              width: calc(100vw - 16px) !important;
              height: calc(100dvh - 16px) !important;
              border-radius: 16px !important;
            }
            .section-picker-header {
              padding: 12px 14px 9px !important;
            }
            .section-picker-toolbar {
              gap: 8px !important;
              padding: 0 14px 10px !important;
            }
            .section-picker-search {
              height: 44px !important;
              flex-basis: 44px !important;
            }
            .section-picker-chip-row {
              box-sizing: border-box;
              width: 100% !important;
              max-width: 100% !important;
              flex: 0 0 auto !important;
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              padding: 0 1px 2px !important;
              overscroll-behavior-x: contain;
              scrollbar-width: none;
            }
            .section-picker-chip-row::-webkit-scrollbar {
              display: none;
            }
            .section-picker-chip {
              min-height: 44px !important;
            }
            .section-picker-body {
              padding: 10px !important;
            }
            .section-picker-catalog {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 10px !important;
              padding-right: 2px !important;
              overscroll-behavior: contain;
              scrollbar-gutter: stable;
            }
            .section-picker-card {
              min-height: 236px !important;
            }
            .section-picker-card-preview {
              height: 104px !important;
              min-height: 104px !important;
            }
            .section-picker-card-meta {
              flex: 0 0 auto !important;
            }
            .section-picker-footer {
              min-height: 54px !important;
              padding: 8px 10px calc(8px + env(safe-area-inset-bottom)) !important;
            }
            .section-picker-footer button {
              min-height: 44px !important;
            }
            .section-picker-footer > .section-picker-status {
              display: none;
            }
          }
        `}</style>
        <DialogHeader className="section-picker-header flex-row items-start justify-between" style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={headerIconStyle}><I.template size={18} aria-hidden="true" /></span>
            <div>
              <DialogTitle id="section-picker-title" style={{ margin: 0, color: 'var(--text)', fontSize: 19, lineHeight: 1.15, fontWeight: 850, letterSpacing: '-.015em' }}>
                Bölüm ekle
              </DialogTitle>
              <DialogDescription id="section-picker-description" style={{ margin: '3px 0 0', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.4 }}>
                Bölümü seçin, gerçek menü görünümünü inceleyin ve tek adımda ekleyin.
              </DialogDescription>
            </div>
          </div>
          <Button className="section-picker-close" ref={closeRef} type="button" variant="outline" size="icon" aria-label="Kapat" onClick={onClose}><XIcon /></Button>
        </DialogHeader>

        <div className="section-picker-toolbar" style={toolbarStyle}>
          <InputGroup className="section-picker-search h-11 w-52 shrink-0">
            <InputGroupAddon><InputGroupText><I.search /></InputGroupText></InputGroupAddon>
            <InputGroupInput
              className="min-h-11"
              data-modal-initial-focus
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Bölüm ara..."
              aria-label="Eklenecek bölüm ara"
            />
          </InputGroup>
          <ToggleGroup className="section-picker-chip-row flex-1 flex-wrap" value={[activeGroup]} onValueChange={(values) => { const next = values[0]; if (next) onGroupChange(next) }} size="sm" spacing={2} aria-label="Kategori filtresi">
            {groups.map((group) => {
              const count = group === 'Tümü' ? sections.length : sections.filter((section) => section.group === group).length
              return (
                <ToggleGroupItem
                  key={group}
                  value={group}
                  variant="outline"
                  className="section-picker-chip"
                >
                  {group}
                  <Badge variant="secondary">{count}</Badge>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>

        <div className="section-picker-body" style={bodyStyle}>
          <ScrollArea className="min-h-0">
          <div className="section-picker-catalog" style={catalogStyle}>
            {visibleSections.length === 0 && (
              <Empty className="col-span-full py-11">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><I.search /></EmptyMedia>
                  <EmptyTitle>Eşleşen bölüm yok</EmptyTitle>
                  <EmptyDescription>Aramayı temizleyin veya başka bir kategori seçin.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent><Button variant="outline" onClick={() => { onSearchChange(''); onGroupChange('Tümü') }}>Filtreleri temizle</Button></EmptyContent>
              </Empty>
            )}
            {visibleSections.map((section) => {
              const instanceCount = countSectionInstances(activeSectionIds, section.id)
              const exists = instanceCount > 0
              const locked = isSectionLocked(section)
              const planned = section.status === 'planned'
              const isSelected = selected?.id === section.id
              return (
                <Card
                  key={section.id}
                  size="sm"
                  data-selected={isSelected}
                  className={cn(
                    'section-picker-card relative min-h-[236px] select-none gap-0 overflow-hidden py-0 transition-[border-color,box-shadow,transform]',
                    isSelected ? 'ring-2 ring-inset ring-primary' : 'hover:-translate-y-0.5 hover:ring-muted-foreground/40 hover:shadow-md',
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`${section.label} bölümünü seç`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(section.id)}
                    className="section-picker-card-select absolute inset-0 z-[3] h-full w-full rounded-xl bg-transparent p-0 hover:bg-transparent focus-visible:ring-inset active:translate-y-0"
                  />
                  <div className="section-picker-card-preview" style={{ ...cardPreviewStyle, opacity: planned ? 0.55 : 1 }} aria-hidden="true" inert>
                    {renderPreview(section.id, true)}
                    {isSelected && <span style={selectedCheckStyle}><I.check size={15} aria-hidden="true" /></span>}
                  </div>
                  <CardHeader className="section-picker-card-meta relative z-[1] flex flex-1 flex-col gap-1.5 px-3 pb-2 pt-2.5" aria-hidden="true">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={sectionIconStyle}><ThemeSectionCatalogIcon icon={section.icon} size={15} /></span>
                      <CardTitle className="min-w-0 flex-1 truncate">{section.label}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 min-h-8 text-xs">{section.sub}</CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-[1] mt-auto flex items-center justify-between gap-1.5 border-t px-3 py-2" aria-hidden="true">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <PlanChip plan={section.plan} />
                        <span className="truncate text-xs font-medium text-muted-foreground">{section.group}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {exists && <StatusPill tone="added">{section.singleton ? 'Etkin' : `${instanceCount} ekli`}</StatusPill>}
                        {planned && <StatusPill tone="warn">Geliştiriliyor</StatusPill>}
                        {locked && !planned && <StatusPill tone="lock">Kilitli</StatusPill>}
                      </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          </ScrollArea>

          <Card size="sm" className="section-picker-detail min-h-0 gap-0 overflow-hidden py-0">
            {selected ? (
              <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 p-4">
                <CardHeader className="gap-1 p-0">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: 11.5, fontWeight: 800 }}>{selected.group}</span>
                    <PlanChip plan={selected.plan} />
                  </div>
                  <CardTitle>{selected.label}</CardTitle>
                  <CardDescription>{selected.sub}</CardDescription>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {selectedExists && <StatusPill tone="added">{selected.singleton
                      ? surface === 'home' ? 'Ana sayfada etkin' : 'Menüde etkin'
                      : `${surface === 'home' ? 'Ana sayfada' : 'Menüde'} ${selectedInstanceCount} tane`}</StatusPill>}
                    {selectedPlanned && <StatusPill tone="warn">Geliştiriliyor</StatusPill>}
                    {selectedLocked && !selectedPlanned && <StatusPill tone="lock">Pro paket</StatusPill>}
                    {!selectedExists && !selectedPlanned && !selectedLocked && <StatusPill tone="ready">Eklenmeye hazır</StatusPill>}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                <div style={detailPreviewStyle} aria-hidden="true" inert>
                  <span style={livePreviewLabelStyle}><I.eye size={13} aria-hidden="true" />Canlı önizleme</span>
                  <div style={{ width: '100%', maxWidth: 300 }}>{renderPreview(selected.id, false)}</div>
                </div>
                <Alert role="note" className="mt-3" variant={selectedPlanned ? 'destructive' : 'default'}>
                  <AlertDescription>
                  {selectedPlanned
                    ? 'Gerçek veri ve aksiyon bağlantısı henüz tamamlanmadığı için bu bölüm şimdilik eklenemez.'
                    : selectedLocked
                      ? 'Bu bölüm hazır; Pro pakete geçtiğinizde menünüze ekleyebilirsiniz.'
                      : selected.global
                        ? selectedExists
                          ? 'Bu araç menü genelinde etkindir. İstek türlerini sağ panelden, görünür konumunu Header → Aksiyon Konumları bölümünden yönetebilirsiniz.'
                          : 'Bu araç kategori bağımsızdır. Eklendiğinde seçili servis konumunda bütün QR menü görünümlerinde kullanılabilir.'
                      : selectedExists
                        ? 'Bu türden yeni bir bölüm daha ekleyebilir; her örneğin kategori kapsamını ve görünümünü sağ panelden bağımsız ayarlayabilirsiniz.'
                        : 'QR menüde kullanılan gerçek bileşenin önizlemesidir. Ekledikten sonra sağ panelden düzenleyebilirsiniz.'}
                  </AlertDescription>
                </Alert>
                </CardContent>
              </div>
              </ScrollArea>
            ) : (
              <Empty className="m-auto min-h-36 p-4"><EmptyHeader><EmptyTitle>Bölüm seçilmedi</EmptyTitle><EmptyDescription>Önizlemek için bir bölüm seçin.</EmptyDescription></EmptyHeader></Empty>
            )}
          </Card>
        </div>

        <DialogFooter className="section-picker-footer mx-0 mb-0 flex-row items-center justify-between rounded-none bg-background px-4 py-2">
          <div className="section-picker-status flex items-center gap-2">
            <Badge variant="positive">{readyCount} hazır</Badge>
            {plannedCount > 0 && <>
              <Separator orientation="vertical" className="h-3" />
              <Badge variant="warning">{plannedCount} geliştiriliyor</Badge>
            </>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button className="section-picker-secondary" type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button
              className="section-picker-primary"
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusPill({ children, tone = 'added' }: { children: ReactNode; tone?: 'added' | 'ready' | 'warn' | 'lock' }) {
  const variant = tone === 'ready' ? 'positive' : tone === 'warn' ? 'warning' : tone === 'lock' ? 'outline' : 'secondary'
  return <Badge variant={variant}>{children}</Badge>
}

function PlanChip({ plan }: { plan: 'starter' | 'pro' }) {
  const pro = plan === 'pro'
  return <Badge variant={pro ? 'default' : 'outline'}>{pro && <I.lock data-icon="inline-start" aria-hidden="true" />}{pro ? 'PRO' : 'STARTER'}</Badge>
}

const dialogStyle: CSSProperties = {
  width: 'min(1040px, calc(100vw - 40px))',
  height: 'min(720px, calc(100vh - 40px))',
  borderRadius: 18,
  background: 'var(--surface)',
  boxShadow: '0 40px 100px -20px rgba(12,16,22,.5), 0 0 0 1px rgba(20,25,31,.04)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = { flexShrink: 0, padding: '16px 20px 13px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }
const headerIconStyle: CSSProperties = { flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: '#e8f5ee', border: '1px solid #cce8d9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#176b45' }
const toolbarStyle: CSSProperties = { flexShrink: 0, padding: '0 20px 13px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }
const bodyStyle: CSSProperties = { flex: 1, minHeight: 0, background: 'var(--surface-inset)', borderTop: '1px solid var(--divider)', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, overflow: 'hidden' }
const catalogStyle: CSSProperties = { minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignContent: 'start', gap: 12, paddingRight: 4 }
const cardPreviewStyle: CSSProperties = { boxSizing: 'border-box', height: 116, minHeight: 116, margin: '7px 7px 0', padding: 6, border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }
const selectedCheckStyle: CSSProperties = { position: 'absolute', top: 7, right: 7, zIndex: 2, width: 23, height: 23, borderRadius: 999, background: '#1c6b40', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 12px -3px rgba(28,107,64,.55)' }
const sectionIconStyle: CSSProperties = { flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }
const detailPreviewStyle: CSSProperties = { boxSizing: 'border-box', minHeight: 250, marginTop: 13, padding: '32px 12px 12px', border: '1px solid var(--divider)', borderRadius: 14, background: 'linear-gradient(160deg, var(--surface-2), var(--surface-inset))', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const livePreviewLabelStyle: CSSProperties = { position: 'absolute', top: 12, left: 12, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6, height: 25, padding: '0 11px', borderRadius: 999, background: 'rgba(255,255,255,.92)', color: 'var(--text-2)', fontSize: 10.5, fontWeight: 800, boxShadow: '0 2px 10px rgba(20,25,31,.1)' }
