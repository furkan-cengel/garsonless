'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AppIcons } from '@garsonless/ui/icons'
import { AccessibleDialog } from './AccessibleDialog'

type MobilePanel = 'filters' | 'list'

export function TablesResponsiveNavigation({
  listOpenRequest = 0,
  header,
  feedback,
  renderFilters,
  renderList,
  tableCount,
  resultCount,
  activeFilterCount,
  onOpenHistory,
}: {
  listOpenRequest?: number
  header: ReactNode
  feedback: ReactNode
  renderFilters: () => ReactNode
  renderList: (afterSelect?: () => void) => ReactNode
  tableCount: number
  resultCount: number
  activeFilterCount: number
  onOpenHistory: () => void
}) {
  const [panel, setPanel] = useState<MobilePanel | null>(null)
  useEffect(() => {
    if (listOpenRequest > 0 && window.matchMedia('(max-width: 1180px)').matches) setPanel('list')
  }, [listOpenRequest])
  const closePanel = () => setPanel(null)
  const panelTitle = panel === 'filters' ? 'Masa filtreleri' : 'Masa listesi'

  return (
    <>
      <aside className="tb-tables__nav" aria-label="Canlı masalar paneli">
        {header}
        {feedback}
        <div className="tb-tables__nav-mobile-actions" aria-label="Mobil masa görünümü seçenekleri">
          <button type="button" aria-haspopup="dialog" aria-expanded={panel === 'list'} onClick={() => setPanel('list')}>
            <AppIcons.section size={16} /><span>Masa listesi<small>{tableCount} masa</small></span>
          </button>
          <button type="button" aria-haspopup="dialog" aria-expanded={panel === 'filters'} onClick={() => setPanel('filters')}>
            <AppIcons.search size={16} /><span>Filtreler<small>{activeFilterCount > 0 ? `${activeFilterCount} aktif` : 'Tümü'}</small></span>
          </button>
          <button type="button" onClick={onOpenHistory}>
            <AppIcons.history size={16} /><span>Geçmiş<small>Taşımalar</small></span>
          </button>
        </div>
        <div className="tb-tables__nav-desktop-content">
          {renderFilters()}
          {renderList()}
        </div>
      </aside>

      {panel && (
        <AccessibleDialog
          labelledBy="tables-mobile-navigation-title"
          onClose={closePanel}
          className="tb-mobile-navigation__overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', background: 'rgba(17,17,19,.4)', backdropFilter: 'blur(3px)' }}
        >
          <section className={`tb-mobile-navigation__panel is-${panel}`}>
            <header>
              <div><span>{panel === 'filters' ? 'Görünümü daralt' : 'Hızlı erişim'}</span><strong id="tables-mobile-navigation-title">{panelTitle}</strong></div>
              <button data-modal-initial-focus type="button" aria-label={`${panelTitle} penceresini kapat`} onClick={closePanel}><AppIcons.close size={16} /></button>
            </header>
            <div className="tb-mobile-navigation__content">
              {panel === 'filters' ? renderFilters() : renderList(closePanel)}
            </div>
            {panel === 'filters' && (
              <footer>
                <span aria-live="polite">{resultCount} masa eşleşiyor</span>
                <button type="button" onClick={closePanel}>Sonuçları göster</button>
              </footer>
            )}
          </section>
        </AccessibleDialog>
      )}
    </>
  )
}
