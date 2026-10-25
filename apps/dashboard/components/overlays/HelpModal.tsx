'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { openGuidedSetup } from '../onboarding/menu-import-client'
import { useEffect, useMemo, useState } from 'react'
import { dashboardHelpLinks, safeSupportUrl } from '../../lib/help-links'
import { SHELL_OVERLAY_IDS, useShell } from '../../lib/shell-context'
import { I, S } from '../../lib/ui'
import { useModalDialogFocus } from './use-modal-dialog-focus'

const HELP_CSS = `
.dashboard-help-overlay {
  position:fixed;inset:0;z-index:100;
  display:flex;align-items:flex-start;justify-content:center;
  padding:clamp(16px,9vh,90px) 16px 16px;
  background:rgba(17,17,19,.45);backdrop-filter:blur(4px);
}
.dashboard-help-dialog {
  width:min(640px,100%);max-height:min(70vh,720px);
  display:flex;flex-direction:column;overflow:hidden;
  background:var(--surface);border-radius:14px;
  box-shadow:0 30px 80px -10px rgba(0,0,0,.4),0 0 0 1px rgba(17,17,19,.06);
}
.dashboard-help-action {
  min-height:56px;display:flex;align-items:center;gap:12px;width:100%;
  padding:8px 12px;border:0;border-radius:7px;background:transparent;
  color:var(--text);text-align:left;text-decoration:none;
}
.dashboard-help-action:hover { background:var(--surface-3); }
.dashboard-help-action:focus-visible,.dashboard-help-close:focus-visible,.dashboard-help-support:focus-visible {
  outline:2px solid var(--action);outline-offset:2px;
}
.dashboard-help-footer { display:flex;align-items:center;justify-content:space-between;gap:12px; }
@media (max-width:760px) {
  .dashboard-help-overlay { align-items:flex-end;padding:0; }
  .dashboard-help-dialog {
    width:100%;max-height:min(82dvh,720px);border-radius:16px 16px 0 0;
    padding-bottom:env(safe-area-inset-bottom);
  }
  .dashboard-help-footer { align-items:stretch;flex-direction:column; }
  .dashboard-help-support { width:100%;justify-content:center; }
}
@media (prefers-reduced-motion:reduce) {
  .dashboard-help-action { transition:none!important; }
}
`

interface Props {
  restaurantId: string
  permissions: string[]
  isOwner: boolean
  onClose: () => void
}

export default function HelpModal({ restaurantId, permissions, isOwner, onClose }: Props) {
  const { beginNavigation } = useShell()
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState(true)
  const dialogRef = useModalDialogFocus(onClose)
  const supportUrl = safeSupportUrl(process.env.NEXT_PUBLIC_SUPPORT_URL)
  const links = useMemo(
    () => dashboardHelpLinks(restaurantId).filter((link) => isOwner || permissions.includes(link.section)),
    [isOwner, permissions, restaurantId],
  )
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  const filtered = normalizedQuery
    ? links.filter((link) => `${link.category} ${link.title} ${link.description}`.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    : links

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine)
    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  return (
    <div
      className="dashboard-help-overlay"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <style>{HELP_CSS}</style>
      <div
        ref={dialogRef}
        id={SHELL_OVERLAY_IDS.help}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-help-title"
        className="dashboard-help-dialog"
        tabIndex={-1}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div id="dashboard-help-title" style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
              Yardım ve kısayollar
            </div>
            <button
              type="button"
              aria-label="Yardımı kapat"
              className="dashboard-help-close"
              onClick={onClose}
              style={{ width: 44, height: 44, margin: -10, border: 0, borderRadius: 8, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}
            >
              <I.x size={17} />
            </button>
          </div>
          <label style={{ display: 'flex', minHeight: 44, alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 8, background: 'var(--surface-3)', color: 'var(--text-3)' }}>
            <I.search size={17} />
            <input
              data-dialog-initial-focus
              aria-label="Yardım işlemlerinde ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Yardım işlemlerinde ara..."
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text)', fontSize: 14 }}
            />
          </label>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px' }}>
          <Button variant="outline" className="mb-3 w-full" onClick={() => { onClose(); openGuidedSetup() }}><I.sparkles data-icon="inline-start" />Kurulum rehberini aç</Button>
          <div style={{ ...S.label, padding: '6px 12px' }}>{query ? 'Sonuçlar' : 'Sık kullanılan işlemler'}</div>
          {filtered.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="dashboard-help-action"
              onClick={() => {
                beginNavigation(link.href)
                onClose()
              }}
            >
              <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--surface-3)', color: 'var(--text-2)' }}>
                <link.Icon size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 650 }}>{link.title}</span>
                <span style={{ display: 'block', marginTop: 2, color: 'var(--text-3)', fontSize: 11.5 }}>{link.description}</span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--text-4)', display: 'inline-flex' }}><I.chevRight size={14} /></span>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div role="status" style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
              &quot;{query}&quot; için eşleşen işlem bulunamadı.
            </div>
          )}
        </div>

        <div className="dashboard-help-footer" style={{ padding: '10px 16px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            <kbd style={{ padding: '2px 6px', marginRight: 5, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', fontFamily: "'Geist Mono', monospace" }}>ESC</kbd>
            kapat
          </span>
          {supportUrl && (online ? (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="dashboard-help-support"
              style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontSize: 12, fontWeight: 550 }}
            >
              <I.sparkles size={13} /> Destek merkezini aç
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="dashboard-help-support"
              style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-3)', color: 'var(--text-3)' }}
            >
              Çevrimdışı - destek bağlantısı kullanılamıyor
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
