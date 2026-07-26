'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { I } from '../../lib/ui'

export type ThemeSectionOption = {
  id: string
  group: string
  label: string
  sub: string
  icon: keyof typeof I
  plan: 'free' | 'pro'
  status: 'ready' | 'planned'
  singleton?: boolean
  global?: boolean
}

function countSectionInstances(activeSectionIds: readonly string[], sectionId: string) {
  return activeSectionIds.filter((id) => id === sectionId || id.startsWith(`${sectionId}--`)).length
}

interface SectionPickerDialogProps {
  closeRef: RefObject<HTMLButtonElement | null>
  search: string
  activeGroup: string
  groups: readonly string[]
  sections: readonly ThemeSectionOption[]
  visibleSections: readonly ThemeSectionOption[]
  activeSectionIds: readonly string[]
  canAddAdvancedSections: boolean
  onSearchChange: (value: string) => void
  onGroupChange: (group: string) => void
  onAddSection: (sectionId: string) => void
  onLockedSection: () => void
  onClose: () => void
  renderPreview: (sectionId: string, compact?: boolean) => ReactNode
}

export function SectionPickerDialog({
  closeRef,
  search,
  activeGroup,
  groups,
  sections,
  visibleSections,
  activeSectionIds,
  canAddAdvancedSections,
  onSearchChange,
  onGroupChange,
  onAddSection,
  onLockedSection,
  onClose,
  renderPreview,
}: SectionPickerDialogProps) {
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
  const selectedLocked = selected?.plan === 'pro' && !canAddAdvancedSections
  const selectedPlanned = selected?.status === 'planned'
  const readyCount = sections.filter((section) => section.status === 'ready').length
  const plannedCount = sections.length - readyCount

  function handlePrimaryAction() {
    if (!selected) return
    if (selectedLocked) {
      onLockedSection()
      return
    }
    if (selectedPlanned || (selected.singleton && selectedExists)) return
    onAddSection(selected.id)
  }

  const primaryDisabled = !selected || selectedPlanned || Boolean(selected.singleton && selectedExists)
  const primaryLabel = selectedPlanned
    ? 'Geliştiriliyor'
    : selectedLocked
      ? 'Pro ile aç'
      : selected?.singleton && selectedExists
        ? 'Menüde etkin'
        : selectedExists
        ? 'Bir tane daha ekle'
        : 'Bölümü ekle'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-picker-title"
      aria-describedby="section-picker-description"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
          return
        }
        trapDialogFocus(event)
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={overlayStyle}
    >
      <div className="section-picker-dialog" style={dialogStyle}>
        <style jsx>{`
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
          .section-picker-card:not([data-selected='true']):hover {
            transform: translateY(-2px);
            border-color: var(--text-3) !important;
            box-shadow: 0 10px 26px rgba(20, 25, 31, .11) !important;
          }
          .section-picker-primary:not(:disabled):hover {
            filter: brightness(.92);
            transform: translateY(-1px);
          }
          .section-picker-close:focus-visible,
          .section-picker-chip:focus-visible,
          .section-picker-card:focus-visible,
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
              flex: 0 0 38px !important;
            }
            .section-picker-body {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .section-picker-detail {
              display: none !important;
            }
          }
          @media (max-width: 560px) {
            .section-picker-catalog {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .section-picker-card {
              min-height: 0 !important;
            }
            .section-picker-footer > .section-picker-status {
              display: none;
            }
          }
        `}</style>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={headerIconStyle}><I.template size={18} aria-hidden="true" /></span>
            <div>
              <h2 id="section-picker-title" style={{ margin: 0, color: 'var(--text)', fontSize: 19, lineHeight: 1.15, fontWeight: 850, letterSpacing: '-.015em' }}>
                Bölüm ekle
              </h2>
              <p id="section-picker-description" style={{ margin: '3px 0 0', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.4 }}>
                Bölümü seçin, gerçek menü görünümünü inceleyin ve tek adımda ekleyin.
              </p>
            </div>
          </div>
          <button className="section-picker-close" ref={closeRef} type="button" aria-label="Kapat" onClick={onClose} style={closeButtonStyle}>×</button>
        </header>

        <div className="section-picker-toolbar" style={toolbarStyle}>
          <label className="section-picker-search" style={searchStyle}>
            <I.search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Bölüm ara..."
              aria-label="Eklenecek bölüm ara"
              style={searchInputStyle}
            />
          </label>
          <div role="group" aria-label="Kategori filtresi" style={chipRowStyle}>
            {groups.map((group) => {
              const count = group === 'Tümü' ? sections.length : sections.filter((section) => section.group === group).length
              const active = activeGroup === group
              return (
                <button
                  key={group}
                  className="section-picker-chip"
                  type="button"
                  onClick={() => onGroupChange(group)}
                  aria-pressed={active}
                  style={{ ...groupButtonStyle, ...(active ? activeGroupButtonStyle : {}) }}
                >
                  {group}
                  <span style={{ ...countStyle, ...(active ? activeCountStyle : {}) }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="section-picker-body" style={bodyStyle}>
          <div className="section-picker-catalog" style={catalogStyle}>
            {visibleSections.length === 0 && (
              <div style={emptyStyle}>
                <I.search size={24} aria-hidden="true" />
                <strong style={{ marginTop: 12, color: 'var(--text)' }}>Eşleşen bölüm yok</strong>
                <span style={{ marginTop: 5, fontSize: 13 }}>Aramayı temizleyin veya başka bir kategori seçin.</span>
                <button
                  className="section-picker-secondary"
                  type="button"
                  onClick={() => {
                    onSearchChange('')
                    onGroupChange('Tümü')
                  }}
                  style={{ ...secondaryButtonStyle, height: 36, marginTop: 16, padding: '0 14px', fontSize: 12.5 }}
                >
                  Filtreleri temizle
                </button>
              </div>
            )}
            {visibleSections.map((section) => {
              const instanceCount = countSectionInstances(activeSectionIds, section.id)
              const exists = instanceCount > 0
              const locked = section.plan === 'pro' && !canAddAdvancedSections
              const planned = section.status === 'planned'
              const isSelected = selected?.id === section.id
              const SectionIcon = I[section.icon]

              return (
                <button
                  key={section.id}
                  className="section-picker-card"
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                  aria-pressed={isSelected}
                  data-selected={isSelected}
                  style={{
                    ...sectionCardStyle,
                    borderColor: isSelected ? '#1c6b40' : 'var(--border)',
                    boxShadow: isSelected ? '0 12px 30px -12px rgba(28,107,64,.4), 0 0 0 1px #1c6b40' : '0 1px 2px rgba(20,25,31,.05)',
                  }}
                >
                  <div className="section-picker-card-preview" style={{ ...cardPreviewStyle, opacity: planned ? 0.55 : 1 }} aria-hidden="true" inert>
                    {renderPreview(section.id, true)}
                    {isSelected && <span style={selectedCheckStyle}><I.check size={15} aria-hidden="true" /></span>}
                  </div>
                  <div className="section-picker-card-meta" style={cardMetaStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={sectionIconStyle}><SectionIcon size={15} /></span>
                      <span style={cardTitleStyle}>{section.label}</span>
                    </div>
                    <p style={cardSubStyle}>{section.sub}</p>
                    <div style={cardFootStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <PlanChip plan={section.plan} />
                        <span style={cardGroupStyle}>{section.group}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {exists && <StatusPill tone="added">{section.singleton ? 'Etkin' : `${instanceCount} ekli`}</StatusPill>}
                        {planned && <StatusPill tone="warn">Geliştiriliyor</StatusPill>}
                        {locked && !planned && <StatusPill tone="lock">Kilitli</StatusPill>}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <aside className="section-picker-detail" style={detailStyle}>
            {selected ? (
              <div style={detailScrollStyle}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: 11.5, fontWeight: 800 }}>{selected.group}</span>
                    <PlanChip plan={selected.plan} />
                  </div>
                  <h3 style={{ margin: '7px 0 0', color: 'var(--text)', fontSize: 19, lineHeight: 1.18, fontWeight: 900, letterSpacing: '-.015em' }}>{selected.label}</h3>
                  <p style={{ margin: '5px 0 0', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.45 }}>{selected.sub}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {selectedExists && <StatusPill tone="added">{selected.singleton ? 'Menüde etkin' : `Menüde ${selectedInstanceCount} tane`}</StatusPill>}
                    {selectedPlanned && <StatusPill tone="warn">Geliştiriliyor</StatusPill>}
                    {selectedLocked && !selectedPlanned && <StatusPill tone="lock">Pro paket</StatusPill>}
                    {!selectedExists && !selectedPlanned && !selectedLocked && <StatusPill tone="ready">Eklenmeye hazır</StatusPill>}
                  </div>
                </div>
                <div style={detailPreviewStyle} aria-hidden="true" inert>
                  <span style={livePreviewLabelStyle}><I.eye size={13} aria-hidden="true" />Canlı önizleme</span>
                  <div style={{ width: '100%', maxWidth: 300 }}>{renderPreview(selected.id, false)}</div>
                </div>
                <div style={{ ...detailNoteStyle, ...(selectedPlanned ? plannedNoteStyle : {}) }}>
                  {selectedPlanned
                    ? 'Gerçek veri ve aksiyon bağlantısı henüz tamamlanmadığı için bu bölüm şimdilik eklenemez.'
                    : selectedLocked
                      ? 'Bu bölüm hazır; Pro pakete geçtiğinizde menünüze ekleyebilirsiniz.'
                      : selected.global
                        ? selectedExists
                          ? 'Bu araç menü genelinde etkindir. Zil bütün kategori görünümlerinde sabit kalır; sağ panelden istekleri ve konumunu özelleştirebilirsiniz.'
                          : 'Bu araç kategori bağımsızdır. Eklendiğinde zil bütün QR menü görünümlerinde sabit kalır ve sağ panelden özelleştirilebilir.'
                      : selectedExists
                        ? 'Bu türden yeni bir bölüm daha ekleyebilir; her örneğin kategori kapsamını ve görünümünü sağ panelden bağımsız ayarlayabilirsiniz.'
                        : 'QR menüde kullanılan gerçek bileşenin önizlemesidir. Ekledikten sonra sağ panelden düzenleyebilirsiniz.'}
                </div>
              </div>
            ) : (
              <div style={{ margin: 'auto', color: 'var(--text-3)', fontSize: 14 }}>Önizlemek için bir bölüm seçin.</div>
            )}
          </aside>
        </div>

        <footer className="section-picker-footer" style={footerStyle}>
          <div className="section-picker-status" style={footerStatusStyle}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ ...statusDotStyle, background: '#2f8f5b' }} />{readyCount} hazır</span>
            {plannedCount > 0 && <>
              <span style={{ width: 1, height: 12, background: 'var(--border)' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ ...statusDotStyle, background: '#e0a33a' }} />{plannedCount} geliştiriliyor</span>
            </>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="section-picker-secondary" type="button" onClick={onClose} style={secondaryButtonStyle}>Vazgeç</button>
            <button
              className="section-picker-primary"
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              style={{
                ...primaryButtonStyle,
                opacity: primaryDisabled ? 0.45 : 1,
                cursor: primaryDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {primaryLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function StatusPill({ children, tone = 'added' }: { children: ReactNode; tone?: 'added' | 'ready' | 'warn' | 'lock' }) {
  const tones: Record<'added' | 'ready' | 'warn' | 'lock', CSSProperties> = {
    added: { background: 'var(--surface-3)', color: 'var(--text-2)' },
    ready: { background: '#e8f5ee', color: '#176b45' },
    warn: { background: '#fbeccd', color: '#8a5100' },
    lock: { background: 'var(--surface-inset)', color: 'var(--text-2)' },
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: 6,
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: '.01em',
      ...tones[tone],
    }}>
      {children}
    </span>
  )
}

function PlanChip({ plan }: { plan: 'free' | 'pro' }) {
  const pro = plan === 'pro'
  return (
    <span style={{
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      height: 19,
      padding: '0 7px',
      borderRadius: 999,
      border: pro ? '1px solid var(--text)' : '1px solid var(--border)',
      background: pro ? 'var(--text)' : 'var(--surface)',
      color: pro ? 'var(--surface)' : 'var(--text-3)',
      fontSize: 10,
      fontWeight: 850,
      letterSpacing: '.04em',
    }}>
      {pro && <I.lock size={9} aria-hidden="true" />}
      {pro ? 'PRO' : 'FREE'}
    </span>
  )
}

function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null)
  if (focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(17,17,19,.48)',
  backdropFilter: 'blur(9px)',
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
const closeButtonStyle: CSSProperties = { flexShrink: 0, width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, transition: 'background 140ms ease, color 140ms ease' }
const toolbarStyle: CSSProperties = { flexShrink: 0, padding: '0 20px 13px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }
const searchStyle: CSSProperties = { width: 200, flex: '0 0 200px', height: 38, display: 'flex', alignItems: 'center', gap: 8, padding: '0 11px', background: 'var(--surface-3)', border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text-3)' }
const searchInputStyle: CSSProperties = { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12.5, fontWeight: 500 }
const chipRowStyle: CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }
const groupButtonStyle: CSSProperties = { flexShrink: 0, height: 32, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease' }
const activeGroupButtonStyle: CSSProperties = { borderColor: 'var(--text)', background: 'var(--text)', color: '#fff' }
const countStyle: CSSProperties = { minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--surface-3)', color: 'var(--text-3)', fontSize: 10.5 }
const activeCountStyle: CSSProperties = { background: 'rgba(255,255,255,.18)', color: '#fff' }
const bodyStyle: CSSProperties = { flex: 1, minHeight: 0, background: 'var(--surface-inset)', borderTop: '1px solid var(--divider)', padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, overflow: 'hidden' }
const catalogStyle: CSSProperties = { minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignContent: 'start', gap: 12, paddingRight: 4 }
const emptyStyle: CSSProperties = { gridColumn: '1 / -1', padding: '44px 20px', textAlign: 'center', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', alignItems: 'center' }
const sectionCardStyle: CSSProperties = { minHeight: 236, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', cursor: 'pointer', position: 'relative', userSelect: 'none', display: 'flex', flexDirection: 'column', transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease' }
const cardPreviewStyle: CSSProperties = { boxSizing: 'border-box', height: 116, minHeight: 116, margin: '7px 7px 0', padding: 6, border: '1px solid var(--divider)', borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }
const selectedCheckStyle: CSSProperties = { position: 'absolute', top: 7, right: 7, zIndex: 2, width: 23, height: 23, borderRadius: 999, background: '#1c6b40', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 12px -3px rgba(28,107,64,.55)' }
const cardMetaStyle: CSSProperties = { minWidth: 0, padding: '10px 12px 15px', display: 'flex', flex: 1, flexDirection: 'column', gap: 6, background: 'var(--surface)', position: 'relative', zIndex: 1 }
const cardTitleStyle: CSSProperties = { flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 14, fontWeight: 800, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis' }
const cardSubStyle: CSSProperties = { margin: 0, color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.4, minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
const cardFootStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto', paddingTop: 8, minHeight: 27, borderTop: '1px solid var(--surface-3)' }
const cardGroupStyle: CSSProperties = { color: 'var(--text-3)', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const sectionIconStyle: CSSProperties = { flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: 'var(--surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }
const detailStyle: CSSProperties = { minHeight: 0, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 14px 36px -24px rgba(20,25,31,.28)' }
const detailScrollStyle: CSSProperties = { flex: 1, minHeight: 0, overflow: 'auto', padding: '17px 16px' }
const detailPreviewStyle: CSSProperties = { boxSizing: 'border-box', minHeight: 250, marginTop: 13, padding: '32px 12px 12px', border: '1px solid var(--divider)', borderRadius: 14, background: 'linear-gradient(160deg, var(--surface-2), var(--surface-inset))', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const livePreviewLabelStyle: CSSProperties = { position: 'absolute', top: 12, left: 12, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6, height: 25, padding: '0 11px', borderRadius: 999, background: 'rgba(255,255,255,.92)', color: 'var(--text-2)', fontSize: 10.5, fontWeight: 800, boxShadow: '0 2px 10px rgba(20,25,31,.1)' }
const detailNoteStyle: CSSProperties = { marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45 }
const plannedNoteStyle: CSSProperties = { background: '#fff7e6', color: '#8a5100' }
const footerStyle: CSSProperties = { minHeight: 58, borderTop: '1px solid var(--divider)', padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const footerStatusStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-3)', fontSize: 11.5, fontWeight: 600 }
const statusDotStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999 }
const secondaryButtonStyle: CSSProperties = { height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease' }
const primaryButtonStyle: CSSProperties = { height: 40, minWidth: 136, padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--action)', color: 'var(--on-action)', fontSize: 13, fontWeight: 850, transition: 'filter 140ms ease, transform 140ms ease' }
