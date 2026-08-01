'use client'

import { useMemo, useState } from 'react'
import {
  EMPTY_TRANSFER_HISTORY_FILTERS,
  filterTransferHistory,
  transferKindLabel,
  transferSessionOutcome,
  transferStatusLabel,
  type TransferHistoryFilters,
  type TransferHistoryViewItem,
} from './table-transfer-history-model'

export type TransferHistoryLoadState = 'idle' | 'loading' | 'ready' | 'error'

const CONTROL_STYLE = {
  minHeight: 44,
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0 10px',
  fontSize: 12.5,
}

function AuditValue({ children }: { children: string }) {
  return <code style={{ fontSize: 10.5, color: 'var(--text-2)', overflowWrap: 'anywhere' }}>{children}</code>
}

export function TableTransferHistory({
  history,
  loadState,
  loadError,
  notice,
  busy,
  tableLabels,
  onRetry,
  onClose,
  onUndo,
}: {
  history: TransferHistoryViewItem[]
  loadState: TransferHistoryLoadState
  loadError: string
  notice: string
  busy: boolean
  tableLabels: Record<string, string>
  onRetry: () => void
  onClose: () => void
  onUndo: (item: TransferHistoryViewItem) => void
}) {
  const [filters, setFilters] = useState<TransferHistoryFilters>(EMPTY_TRANSFER_HISTORY_FILTERS)
  const filtered = useMemo(
    () => filterTransferHistory(history, filters, tableLabels),
    [filters, history, tableLabels],
  )
  const filtersActive = filters.query.trim() !== '' || filters.kind !== 'all' || filters.status !== 'all'

  if (loadState === 'idle' || loadState === 'loading') {
    return <div role="status" aria-live="polite" style={{ padding: 18, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>Taşıma geçmişi yükleniyor…</div>
  }
  if (loadState === 'error') {
    return (
      <div role="alert" style={{ padding: 14, borderRadius: 9, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12.5 }}>
        {loadError || 'Taşıma geçmişi alınamadı.'}
        <button type="button" onClick={onRetry} style={{ display: 'block', minHeight: 44, marginTop: 10, border: '1px solid currentColor', borderRadius: 7, background: 'transparent', color: 'inherit', padding: '7px 10px', fontWeight: 750, cursor: 'pointer' }}>Tekrar dene</button>
      </div>
    )
  }
  if (loadState === 'ready' && history.length === 0) {
    return (
      <div style={{ padding: '22px 16px', border: '1px dashed var(--border-strong)', borderRadius: 10, textAlign: 'center', background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 14, fontWeight: 750 }}>Henüz taşıma yok</div>
        <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-3)' }}>İlk masa veya hesap taşımanız tamamlandığında burada görünecek.</div>
        <button type="button" onClick={onClose} style={{ minHeight: 44, marginTop: 14, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>Masalara dön</button>
      </div>
    )
  }

  return (
    <>
      <div aria-label="Taşıma geçmişi filtreleri" style={{ display: 'grid', gap: 8 }}>
        <input
          type="search"
          aria-label="Taşıma geçmişinde ara"
          placeholder="Masa, yetkili veya işlem kimliği ara"
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          style={{ ...CONTROL_STYLE, width: '100%' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <select aria-label="Taşıma türü filtresi" value={filters.kind} onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value as TransferHistoryFilters['kind'] }))} style={CONTROL_STYLE}>
            <option value="all">Tüm işlemler</option>
            <option value="table_move">Masa taşıma</option>
            <option value="account_transfer">Hesap taşıma</option>
            <option value="item_transfer">Ürün taşıma</option>
          </select>
          <select aria-label="Taşıma durumu filtresi" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as TransferHistoryFilters['status'] }))} style={CONTROL_STYLE}>
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="undone">Geri alındı</option>
            <option value="locked">Kilitli</option>
          </select>
        </div>
        <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
          <span style={{ flex: 1 }}>{filtered.length} / {history.length} işlem</span>
          {filtersActive && <button type="button" onClick={() => setFilters(EMPTY_TRANSFER_HISTORY_FILTERS)} style={{ minHeight: 44, border: 0, background: 'transparent', color: 'var(--action)', cursor: 'pointer', padding: '6px 0', fontWeight: 700 }}>Filtreleri temizle</button>}
        </div>
      </div>

      {filtered.length === 0 && (
        <div role="status" style={{ padding: 18, border: '1px dashed var(--border-strong)', borderRadius: 10, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
          Filtrelerle eşleşen taşıma bulunamadı.
        </div>
      )}

      {filtered.map((item) => {
        const statusLabel = transferStatusLabel(item.status)
        return (
          <article key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'grid', gap: 9 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{transferKindLabel(item.kind)} · {item.orderCount} sipariş</strong>
                  <span style={{ padding: '2px 7px', borderRadius: 999, background: item.status === 'active' ? 'var(--positive-bg)' : item.status === 'locked' ? 'var(--critical-bg)' : 'var(--surface-3)', color: item.status === 'active' ? 'var(--positive)' : item.status === 'locked' ? 'var(--critical)' : 'var(--text-2)', fontSize: 10.5, fontWeight: 750 }}>{statusLabel}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>
                  {tableLabels[item.sourceTableId] ?? 'Masa'} → {tableLabels[item.targetTableId] ?? 'Masa'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 4 }}>
                  İşlemi yapan: <strong>{item.actorLabel}</strong> · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('tr-TR')}</time>
                </div>
                {item.lockReason && <div style={{ fontSize: 11, color: 'var(--critical)', marginTop: 4 }}>{item.lockReason}</div>}
              </div>
              {item.status === 'active' && <button disabled={busy} type="button" onClick={() => onUndo(item)} style={{ minHeight: 44, border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', padding: '7px 10px', cursor: busy ? 'wait' : 'pointer', fontWeight: 700 }}>Geri al</button>}
            </div>
            <details style={{ borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', minHeight: 44, display: 'flex', alignItems: 'center' }}>Audit ayrıntıları</summary>
              <dl style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '7px 10px', margin: '8px 0 0', fontSize: 11 }}>
                <dt style={{ color: 'var(--text-3)' }}>Sonuç</dt><dd style={{ margin: 0 }}>{transferSessionOutcome(item)}</dd>
                <dt style={{ color: 'var(--text-3)' }}>İşlem kimliği</dt><dd style={{ margin: 0 }}><AuditValue>{item.id}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>İstek kimliği</dt><dd style={{ margin: 0 }}><AuditValue>{item.requestId}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>Kaynak adisyon</dt><dd style={{ margin: 0 }}><AuditValue>{item.sourceSessionId}</AuditValue></dd>
                <dt style={{ color: 'var(--text-3)' }}>Hedef adisyon</dt><dd style={{ margin: 0 }}><AuditValue>{item.targetSessionId}</AuditValue></dd>
                {item.undoneAt && <><dt style={{ color: 'var(--text-3)' }}>Geri alma</dt><dd style={{ margin: 0 }}>{item.undoActorLabel ?? 'Başka bir yetkili'} · <time dateTime={item.undoneAt}>{new Date(item.undoneAt).toLocaleString('tr-TR')}</time></dd></>}
              </dl>
            </details>
          </article>
        )
      })}
      {notice && <div role="status" aria-live="polite" style={{ padding: 10, borderRadius: 8, background: 'var(--positive-bg)', color: 'var(--positive)', fontSize: 12, fontWeight: 700 }}>{notice}</div>}
    </>
  )
}
