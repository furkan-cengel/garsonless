'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type {
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignSummary,
} from '@garsonless/domain/campaigns'
import {
  isCustomerLapsed,
  isCustomerNew,
  type CustomerSegment,
  type CustomerSegmentDefinition,
  type CustomerSort,
  type RestaurantCustomer,
  type RestaurantCustomersPage,
  type CustomerSegmentCounts,
  type SavedCustomerSegment,
} from '@garsonless/domain/customers'
import {
  createCustomerSegmentAction,
  deleteCustomerSegmentAction,
  listCustomers,
  updateCustomerSegmentAction,
} from '../../lib/actions/customers'
import {
  previewCampaignAudienceAction,
  sendCampaignAction,
  sendCampaignTestAction,
} from '../../lib/actions/campaigns'
import { formatCurrency } from '../../lib/utils'
import { I, S, btnGhost, btnPrimary } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'
import { AccessibleDialog } from '../tables/AccessibleDialog'
import { useShell } from '../../lib/shell-context'
import {
  customerListHref,
  parseCustomerListState,
  type CustomerListState,
} from './customer-list-state'

const SEGMENTS: { id: CustomerSegment | ''; label: string }[] = [
  { id: '', label: 'Tümü' },
  { id: 'new', label: 'Yeni müşteriler' },
  { id: 'frequent', label: 'Sık gelenler' },
  { id: 'lapsed', label: 'Uzun süredir gelmeyen' },
  { id: 'consented', label: 'İzinli' },
]
const SORTS: { id: CustomerSort; label: string }[] = [
  { id: 'last_seen', label: 'Son görülme' },
  { id: 'spend', label: 'En çok harcayan' },
  { id: 'visits', label: 'En çok ziyaret' },
  { id: 'points', label: 'En yüksek puan' },
  { id: 'joined', label: 'İlk aktivite' },
]
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function relTime(iso: string | null, referenceNow: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const days = Math.floor((new Date(referenceNow).getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 30) return `${days} gün önce`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function initials(name: string | null): string {
  const parts = (name || 'İsimsiz').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (parts[0] ?? 'M').slice(0, 2).toUpperCase()
}

function softForTier(color: string): string {
  const map: Record<string, string> = {
    '#b87333': '#f3e7dc',
    '#8a9099': '#eceef0',
    '#c8922a': '#f6ecd6',
    '#5b7a86': '#e3edf0',
  }
  return map[color.toLowerCase()] ?? 'var(--surface-3)'
}

function tagsForCustomer(c: RestaurantCustomer, referenceNow: string): string[] {
  const tags: string[] = [c.authLinked ? 'Bağlı hesap' : 'Bağlantısız kayıt']
  if (isCustomerNew(c.firstSeen, referenceNow)) tags.push('Yeni müşteri')
  if (c.visits >= 3) tags.push('Sık gelen')
  if (c.tierIndex >= 2) tags.push('VIP')
  if (isCustomerLapsed(c.lastSeen, referenceNow)) tags.push('Uzun süredir gelmeyen')
  if (!c.hasConsent) tags.push('İzin yok')
  return tags.slice(0, 3)
}

export default function CustomersClient({
  restaurantId,
  restaurantName,
  initial,
  initialSegmentCounts,
  initialSegments,
  initialCampaigns,
  canManageCampaigns,
  smsDeliveryEnabled,
  initialState,
  referenceNow,
}: {
  restaurantId: string
  restaurantName: string
  initial: RestaurantCustomersPage
  initialSegmentCounts: CustomerSegmentCounts & { all: number }
  initialSegments: SavedCustomerSegment[]
  initialCampaigns: CampaignSummary[]
  canManageCampaigns: boolean
  smsDeliveryEnabled: boolean
  initialState: CustomerListState
  referenceNow: string
}) {
  const { beginNavigation } = useShell()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<RestaurantCustomersPage>(initial)
  const [savedSegments, setSavedSegments] = useState<SavedCustomerSegment[]>(initialSegments)
  const [search, setSearch] = useState(initialState.search)
  const [segment, setSegment] = useState<CustomerSegment | ''>(initialState.segment)
  const [customSegmentId, setCustomSegmentId] = useState<string | null>(initialState.customSegmentId)
  const [sort, setSort] = useState<CustomerSort>(initialState.sort)
  const [page, setPage] = useState(initialState.page)
  const [editor, setEditor] = useState<SegmentEditorState | null>(null)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>(initialCampaigns)
  const [segmentError, setSegmentError] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)
  const [segmentToDelete, setSegmentToDelete] = useState<SavedCustomerSegment | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listRetry, setListRetry] = useState(0)
  const [pending, startTransition] = useTransition()
  const firstRender = useRef(true)
  const requestSequence = useRef(0)

  useEffect(() => {
    const href = customerListHref(pathname, { search, segment, customSegmentId, sort, page })
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, '', href)
    }
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => {
      const sequence = ++requestSequence.current
      startTransition(async () => {
        try {
          const res = await listCustomers(restaurantId, { search, segment, customSegmentId, sort, page })
          if (sequence !== requestSequence.current) return
          if ('error' in res) setListError(res.error)
          else {
            setData(res)
            setListError(null)
          }
        } catch {
          if (sequence === requestSequence.current) {
            setListError('Müşteriler yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.')
          }
        }
      })
    }, 250)
    return () => clearTimeout(t)
  }, [restaurantId, pathname, search, segment, customSegmentId, sort, page, listRetry])

  useEffect(() => {
    const retryWhenOnline = () => setListRetry((value) => value + 1)
    window.addEventListener('online', retryWhenOnline)
    return () => window.removeEventListener('online', retryWhenOnline)
  }, [])

  useEffect(() => {
    const restoreUrlState = () => {
      const restored = parseCustomerListState(new URLSearchParams(window.location.search))
      setSearch(restored.search)
      setSegment(restored.segment)
      setCustomSegmentId(restored.customSegmentId)
      setSort(restored.sort)
      setPage(restored.page)
    }
    window.addEventListener('popstate', restoreUrlState)
    return () => window.removeEventListener('popstate', restoreUrlState)
  }, [])

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const activeSavedSegment = customSegmentId
    ? savedSegments.find((sg) => sg.id === customSegmentId) ?? null
    : null
  const hasActiveFilters = Boolean(search.trim() || segment || customSegmentId)

  function countForBuiltIn(id: string): number {
    if (id === '') return initialSegmentCounts.all
    if (id === 'new' || id === 'frequent' || id === 'lapsed' || id === 'consented') {
      return initialSegmentCounts[id]
    }
    return 0
  }

  function applyBuiltInSegment(id: CustomerSegment | '') {
    setSegment(id)
    setCustomSegmentId(null)
    setPage(1)
  }

  function applySavedSegment(id: string) {
    setCustomSegmentId(id)
    setSegment('')
    setPage(1)
  }

  function openCreateFromCurrent() {
    const fromSaved = activeSavedSegment
    const builtIn = SEGMENTS.find((sg) => sg.id === segment)
    setSegmentError(null)
    setEditor({
      mode: 'create',
      name: fromSaved ? `${fromSaved.name} kopya` : builtIn?.id ? builtIn.label : 'Yeni segment',
      definition: fromSaved?.definition ?? definitionFromBuiltIn(segment),
    })
  }

  function openEditSegment(saved: SavedCustomerSegment) {
    setSegmentError(null)
    setEditor({
      mode: 'edit',
      segmentId: saved.id,
      name: saved.name,
      definition: saved.definition,
    })
  }

  async function handleSaveSegment(input: { name: string; definition: CustomerSegmentDefinition }) {
    if (!editor) return
    setSavingSegment(true)
    setSegmentError(null)
    const res = editor.mode === 'edit'
      ? await updateCustomerSegmentAction(restaurantId, editor.segmentId, input)
      : await createCustomerSegmentAction(restaurantId, input)
    setSavingSegment(false)
    if ('error' in res) {
      setSegmentError(res.error)
      return
    }
    setSavedSegments((prev) => {
      if (editor.mode === 'edit') return prev.map((sg) => sg.id === res.id ? res : sg)
      return [...prev, res]
    })
    setCustomSegmentId(res.id)
    setSegment('')
    setPage(1)
    setEditor(null)
  }

  async function handleDeleteSegment(saved: SavedCustomerSegment) {
    setSegmentError(null)
    const res = await deleteCustomerSegmentAction(restaurantId, saved.id)
    if ('error' in res) {
      setSegmentError(res.error)
      return
    }
    setSavedSegments((prev) => prev.filter((sg) => sg.id !== saved.id))
    if (customSegmentId === saved.id) {
      setCustomSegmentId(null)
      setSegment('')
      setPage(1)
    }
    setSegmentToDelete(null)
  }

  function resetFilters() {
    setSearch('')
    setSegment('')
    setCustomSegmentId(null)
    setSort('last_seen')
    setPage(1)
  }

  return (
    <div className="customer-route-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title="Müşteriler" tag={<span style={{ ...S.caption }}>{initialSegmentCounts.all} müşteri</span>} />

      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-page-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
          <div className="customer-list-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.025em', margin: 0 }}>Müşteriler</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '5px 0 0' }}>Üyeler, sadakat bakiyeleri ve ziyaret geçmişi</p>
            </div>
            <div className="customer-page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canManageCampaigns && <button type="button" className="customer-control customer-action-secondary" onClick={() => setCampaignOpen(true)} style={{ ...btnGhost({ height: 36, padding: '0 12px', borderRadius: 7, fontSize: 12.5 }) }}>
                <I.bell size={14} />SMS kampanyası
              </button>}
              <button type="button" className="customer-control customer-action-primary" onClick={openCreateFromCurrent} style={{ ...btnPrimary({ height: 36, padding: '0 12px', borderRadius: 7, fontSize: 12.5 }) }}>
                <I.plus size={13} />Filtreyi kaydet
              </button>
            </div>
          </div>

          {!canManageCampaigns && (
            <div role="status" style={{ margin: '-6px 0 18px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.45 }}>
              İletişim bilgileri güvenlik nedeniyle maskeli gösterilir. SMS kampanyası ve manuel puan/bakiye düzenlemeleri yalnız işletme sahibine açıktır.
            </div>
          )}

          {listError && (
            <div role="alert" aria-live="polite" style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid var(--critical)', borderRadius: 10, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12.5, lineHeight: 1.45, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>{listError}</span>
              <button type="button" className="customer-control customer-action-secondary" onClick={() => setListRetry((value) => value + 1)} style={btnGhost({ height: 34, padding: '0 11px' })}>Yeniden dene</button>
            </div>
          )}

          <div className="customer-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
            <MiniStat label="Toplam müşteri" value={initialSegmentCounts.all.toLocaleString('tr-TR')} icon={<I.users size={15} />} />
            <MiniStat label="İletişim izinli" value={initialSegmentCounts.consented.toLocaleString('tr-TR')} icon={<I.check size={15} />} sub={`Tüm müşterilerin %${initialSegmentCounts.all ? Math.round((initialSegmentCounts.consented / initialSegmentCounts.all) * 100) : 0}'i`} />
            <MiniStat label="Sık gelen" value={initialSegmentCounts.frequent.toLocaleString('tr-TR')} icon={<I.star size={15} />} sub="En az 3 ziyaret" />
            <MiniStat label="Geri kazanılacak" value={initialSegmentCounts.lapsed.toLocaleString('tr-TR')} icon={<I.clock size={15} />} sub="60+ gündür gelmeyen" />
          </div>

          <div className="customer-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div className="customer-search" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 3px 0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-1)' }}>
              <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><I.search size={16} /></span>
              <input
                aria-label="Müşteri ara"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Ad veya telefon sonu (örn. 67)"
                style={{ flex: 1, minWidth: 0, height: 38, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text)' }}
              />
              {search && <button type="button" className="customer-control customer-clear-action" aria-label="Aramayı temizle" onClick={() => { setSearch(''); setPage(1) }} style={{ ...btnGhost({ width: 32, minWidth: 32, height: 32, padding: 0, justifyContent: 'center', border: 'none' }) }}><I.close size={13} /></button>}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Sırala</span>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value as CustomerSort); setPage(1) }}
                className="customer-sort-control"
                style={{ height: 38, padding: '0 30px 0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 500, outline: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-1)' }}
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {SEGMENTS.map((sg) => {
              const active = !customSegmentId && segment === sg.id
              return (
                <button
                  key={sg.id}
                  type="button"
                  className="customer-control customer-segment-filter"
                  aria-pressed={active}
                  onClick={() => applyBuiltInSegment(sg.id)}
                  style={{
                    minHeight: 34,
                    padding: '0 11px',
                    borderRadius: 99,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 650 : 500,
                    background: active ? 'var(--action)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--action)' : 'var(--border)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    transition: 'all 140ms',
                  }}
                >
                  {sg.label}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: active ? 'rgba(255,255,255,.2)' : 'var(--surface-3)', color: active ? '#fff' : 'var(--text-3)' }}>
                    {countForBuiltIn(sg.id)}
                  </span>
                </button>
              )
            })}
          </div>

          {savedSegments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-3)', letterSpacing: '.04em' }}>KAYITLI</span>
              {savedSegments.map((saved) => {
                const active = customSegmentId === saved.id
                return (
                  <span key={saved.id} className="customer-saved-segment" data-active={active} style={{ display: 'inline-flex', alignItems: 'center', height: 34, borderRadius: 99, border: `1px solid ${active ? 'var(--action)' : 'var(--border)'}`, background: active ? 'var(--action)' : 'var(--surface)', overflow: 'hidden', boxShadow: active ? 'none' : 'var(--shadow-1)' }}>
                    <button type="button" className="customer-control customer-saved-segment-label" aria-pressed={active} onClick={() => applySavedSegment(saved.id)} title={describeDefinition(saved.definition)}
                      style={{ height: 32, padding: '0 8px 0 11px', border: 'none', background: 'transparent', color: active ? '#fff' : 'var(--text-2)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                      {saved.name}
                    </button>
                    <button type="button" className="customer-control customer-saved-segment-icon" onClick={() => openEditSegment(saved)} aria-label={`${saved.name} düzenle`} style={segmentIconBtn(active)}><I.gear size={12} /></button>
                    <button type="button" className="customer-control customer-saved-segment-icon customer-saved-segment-delete" onClick={() => setSegmentToDelete(saved)} aria-label={`${saved.name} sil`} style={segmentIconBtn(active)}><I.trash size={12} /></button>
                  </span>
                )
              })}
            </div>
          )}

          {canManageCampaigns && campaigns.length > 0 && (
            <CampaignStrip campaigns={campaigns.slice(0, 3)} onOpen={() => setCampaignOpen(true)} />
          )}

          {segmentError && <div style={{ marginBottom: 12, color: 'var(--critical)', fontSize: 12.5 }}>{segmentError}</div>}

          <div className="customer-table" aria-busy={pending} style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', overflow: 'auto', opacity: pending ? 0.72 : 1, transition: 'opacity 120ms' }}>
            {pending && <div role="status" aria-live="polite" style={{ position: 'absolute', right: 14, top: 10, zIndex: 2, padding: '5px 9px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)', fontSize: 11.5, color: 'var(--text-2)' }}>Güncelleniyor…</div>}
            <div className="customer-grid-row" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em' }}>
              <span>MÜŞTERİ</span><span>TELEFON</span><span>SEVİYE</span><span style={{ textAlign: 'right' }}>ZİYARET</span><span style={{ textAlign: 'right' }}>HARCAMA</span><span style={{ textAlign: 'right' }}>PUAN</span><span style={{ textAlign: 'right' }}>SON GÖRÜLME</span>
            </div>
            {data.customers.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>
                <div style={{ fontWeight: 650, color: 'var(--text-2)', marginBottom: 6 }}>Eşleşen müşteri yok</div>
                <div style={{ marginBottom: 14 }}>Arama veya segment ölçütlerini değiştirin.</div>
                {hasActiveFilters && <button type="button" className="customer-control customer-action-secondary" onClick={resetFilters} style={btnGhost()}>Filtreleri temizle</button>}
              </div>
            ) : (
              data.customers.map((c, i) => (
                <CustomerRow
                  key={c.customerId}
                  c={c}
                  delay={i * 25}
                  referenceNow={referenceNow}
                  onClick={() => {
                    const returnTo = customerListHref(pathname, { search, segment, customSegmentId, sort, page })
                    const href = `/dashboard/${restaurantId}/customers/${c.customerId}?returnTo=${encodeURIComponent(returnTo)}`
                    beginNavigation(href)
                    router.push(href)
                  }}
                />
              ))
            )}
          </div>

          <div className="customer-table-scroll-hint" role="status" style={{ display: 'none', marginTop: 8, color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.4 }}>
            Tüm sütunları görmek için tabloyu yatay kaydırın.
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
            {data.total > 0 ? `${data.total} eşleşmeden ${data.customers.length} müşteri gösteriliyor` : 'Gösterilecek müşteri yok'}
          </div>

          {data.total > data.pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
              <button type="button" className="customer-control customer-pager" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pagerBtn(page <= 1)}>‹ Önceki</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className="customer-control customer-pager" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pagerBtn(page >= totalPages)}>Sonraki ›</button>
            </div>
          )}
        </div>
      </div>

      {editor && (
        <SegmentEditorModal
          state={editor}
          saving={savingSegment}
          error={segmentError}
          onClose={() => setEditor(null)}
          onSave={handleSaveSegment}
        />
      )}
      {canManageCampaigns && campaignOpen && (
        <CampaignModal
          restaurantId={restaurantId}
          savedSegments={savedSegments}
          campaigns={campaigns.slice(0, 6)}
          smsDeliveryEnabled={smsDeliveryEnabled}
          initialTarget={customSegmentId ? `custom:${customSegmentId}` : segment ? `builtin:${segment}` : 'all'}
          onClose={() => setCampaignOpen(false)}
          onSent={(campaign) => setCampaigns((prev) => [campaign, ...prev.filter((c) => c.id !== campaign.id)])}
        />
      )}
      {segmentToDelete && (
        <ConfirmDialog
          title="Segment silinsin mi?"
          description={`“${segmentToDelete.name}” kayıtlı filtresi silinecek. Müşteri verileri etkilenmez.`}
          confirmLabel="Segmenti sil"
          onClose={() => setSegmentToDelete(null)}
          onConfirm={() => { void handleDeleteSegment(segmentToDelete) }}
        />
      )}
      <style>{`
        .customer-page-topbar { position: sticky; top: 0; z-index: 30; }
        .customer-control,
        .customer-campaign-strip {
          transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease, filter 140ms ease, transform 140ms ease;
        }
        .customer-action-secondary:not(:disabled):hover,
        .customer-pager:not(:disabled):hover {
          background: var(--surface-inset) !important;
          border-color: var(--text-2) !important;
          color: var(--text) !important;
          box-shadow: 0 4px 12px rgba(17,17,19,.1);
          transform: translateY(-1px);
        }
        .customer-action-primary:not(:disabled):hover {
          filter: brightness(.82);
          box-shadow: 0 5px 14px rgba(17,17,19,.22);
          transform: translateY(-1px);
        }
        .customer-segment-filter:not(:disabled):hover {
          background: var(--surface-3) !important;
          border-color: var(--text-3) !important;
          color: var(--text) !important;
          box-shadow: var(--shadow-1);
          transform: translateY(-1px);
        }
        .customer-segment-filter[aria-pressed="true"]:not(:disabled):hover {
          background: var(--action) !important;
          border-color: var(--action) !important;
          color: #fff !important;
          filter: brightness(.84);
        }
        .customer-clear-action:not(:disabled):hover,
        .customer-saved-segment-label:not(:disabled):hover,
        .customer-saved-segment-icon:not(:disabled):hover {
          background: var(--surface-3) !important;
          color: var(--text) !important;
        }
        .customer-saved-segment[data-active="true"] .customer-saved-segment-label:not(:disabled):hover,
        .customer-saved-segment[data-active="true"] .customer-saved-segment-icon:not(:disabled):hover {
          background: rgba(255,255,255,.16) !important;
          color: #fff !important;
        }
        .customer-saved-segment-delete:not(:disabled):hover {
          background: var(--critical-bg) !important;
          color: var(--critical) !important;
        }
        .customer-campaign-strip:not(:disabled):hover {
          background: var(--surface-2) !important;
          border-color: var(--text-3) !important;
          box-shadow: var(--shadow-2);
          transform: translateY(-1px);
        }
        .customer-sort-control:hover { border-color: var(--text-3) !important; }
        button.customer-row-action:hover { background: var(--surface-2) !important; }
        .customer-control:not(:disabled):active,
        .customer-campaign-strip:not(:disabled):active {
          box-shadow: none;
          transform: translateY(0);
        }
        @media (pointer: coarse) {
          .customer-control,
          .customer-segment-filter,
          .customer-pager { min-height: 44px !important; }
          .customer-clear-action,
          .customer-saved-segment-icon { min-width: 44px !important; }
          .customer-saved-segment { height: 46px !important; }
          .customer-search { height: 46px !important; }
          .customer-search input,
          .customer-sort-control { height: 44px !important; }
        }
        @media (max-width: 820px) {
          .customer-page-content { padding: 22px 20px 48px !important; }
          .customer-list-header { align-items: stretch !important; flex-direction: column !important; }
          .customer-page-actions { justify-content: stretch !important; }
          .customer-page-actions > button { flex: 1 1 0 !important; min-height: 44px !important; }
          .customer-control,
          .customer-segment-filter,
          .customer-pager { min-height: 44px !important; }
          .customer-clear-action,
          .customer-saved-segment-icon { min-width: 44px !important; }
          .customer-saved-segment { height: 46px !important; }
          .customer-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .customer-toolbar { align-items: stretch !important; flex-direction: column !important; }
          .customer-toolbar label { justify-content: space-between !important; }
          .customer-toolbar select { flex: 1 !important; min-width: 0 !important; height: 44px !important; }
          .customer-search { height: 46px !important; }
          .customer-search input { height: 44px !important; }
          .customer-table { overflow-x: auto !important; }
          .customer-grid-row { min-width: 900px; }
          .customer-table-scroll-hint { display: block !important; }
        }
        @media (max-width: 520px) {
          .customer-page-content { padding: 20px 12px 44px !important; }
          .customer-stats { grid-template-columns: 1fr !important; }
          .customer-page-actions > button { padding-left: 10px !important; padding-right: 10px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .customer-control,
          .customer-campaign-strip { transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  )
}

function ConfirmDialog({ title, description, confirmLabel, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(17,17,19,.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="customer-confirm-title" aria-describedby="customer-confirm-description" style={{ width: 'min(440px,100%)', padding: 20, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,.24)' }}>
        <div id="customer-confirm-title" style={{ fontSize: 17, fontWeight: 750 }}>{title}</div>
        <p id="customer-confirm-description" style={{ margin: '8px 0 20px', color: 'var(--text-2)', fontSize: 13.5, lineHeight: 1.55 }}>{description}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btnGhost()}>Vazgeç</button>
          <button type="button" onClick={onConfirm} style={btnPrimary({ background: 'var(--critical)' })}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon, sub, mono }: { label: string; value: string; icon: ReactNode; sub?: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
        <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 750, marginTop: 6, letterSpacing: '-0.02em', ...(mono ? S.mono : {}) }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function CustomerRow({ c, onClick, delay, referenceNow }: { c: RestaurantCustomer; onClick: () => void; delay: number; referenceNow: string }) {
  const [hover, setHover] = useState(false)
  const tags = tagsForCustomer(c, referenceNow)
  const soft = softForTier(c.tier.color)
  return (
    <button
      className="customer-grid-row customer-row-action"
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr',
        gap: 12,
        width: '100%',
        padding: '14px 20px',
        border: 'none',
        borderBottom: '1px solid var(--divider)',
        alignItems: 'center',
        cursor: 'pointer',
        background: hover ? 'var(--surface-2)' : 'transparent',
        transition: 'background 120ms',
        textAlign: 'left',
        animation: 'rowIn 300ms ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 999, background: soft, color: c.tier.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, fontSize: 13, flexShrink: 0 }}>{initials(c.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || 'İsimsiz'}</div>
          {tags.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
        </div>
      </div>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...S.mono }}>
        <span style={{ fontSize: 13, color: c.phoneMasked ? 'var(--text-3)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone}</span>
        <span style={{ fontSize: 11, color: c.emailMasked ? 'var(--text-4)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
      </span>
      <span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: c.tier.color, background: soft, padding: '3px 10px', borderRadius: 99 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: c.tier.color }} />{c.tier.name}
        </span>
      </span>
      <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, color: c.visits ? 'var(--text)' : 'var(--text-4)' }}>{c.visits}</span>
      <span style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 500, color: c.spend ? 'var(--text)' : 'var(--text-4)', ...S.mono }}>{formatCurrency(c.spend)}</span>
      <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#c8922a' }}>{c.points}</span>
      <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {relTime(c.lastSeen, referenceNow)}
        <span style={{ color: 'var(--text-4)', opacity: hover ? 1 : 0, transition: 'opacity 120ms' }}><I.chevRight size={11} /></span>
      </span>
    </button>
  )
}

function CampaignStrip({ campaigns, onOpen }: { campaigns: CampaignSummary[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="customer-campaign-strip"
      onClick={onOpen}
      style={{
        width: '100%',
        margin: '0 0 16px',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-1)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        <I.bell size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Son SMS kampanyaları</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {campaigns.map((c) => `${c.name} (${c.sentCount}/${c.recipientCount})`).join(' · ')}
        </span>
      </span>
      <span style={{ color: 'var(--text-4)' }}><I.chevRight size={14} /></span>
    </button>
  )
}

type CampaignTargetValue = 'all' | `builtin:${string}` | `custom:${string}`

function targetToAudience(target: CampaignTargetValue): CampaignAudienceInput {
  if (target.startsWith('builtin:')) {
    const builtinSegment = target.slice('builtin:'.length)
    if (builtinSegment === 'new' || builtinSegment === 'frequent' || builtinSegment === 'lapsed' || builtinSegment === 'consented') {
      return { segmentKind: 'builtin', builtinSegment }
    }
  }
  if (target.startsWith('custom:')) return { segmentKind: 'custom', customSegmentId: target.slice('custom:'.length) }
  return { segmentKind: 'all' }
}

function CampaignModal({
  restaurantId,
  savedSegments,
  campaigns,
  smsDeliveryEnabled,
  initialTarget,
  onClose,
  onSent,
}: {
  restaurantId: string
  savedSegments: SavedCustomerSegment[]
  campaigns: CampaignSummary[]
  smsDeliveryEnabled: boolean
  initialTarget: CampaignTargetValue
  onClose: () => void
  onSent: (campaign: CampaignSummary) => void
}) {
  const [target, setTarget] = useState<CampaignTargetValue>(initialTarget)
  const [name, setName] = useState('Geri kazanım SMS')
  const [message, setMessage] = useState('Merhaba, size özel fırsatlarımız hazır. Menüyü açıp ödüllerinizi kontrol edebilirsiniz.')
  const [testPhone, setTestPhone] = useState('')
  const [preview, setPreview] = useState<CampaignAudiencePreview | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sending, setSending] = useState(false)
  const sendRequestId = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    setPreviewing(true)
    setError(null)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await previewCampaignAudienceAction(restaurantId, targetToAudience(target))
          if (!alive) return
          if ('error' in res) {
            setPreview(null)
            setError(res.error)
          } else {
            setPreview(res)
          }
        } catch {
          if (alive) { setPreview(null); setError('Alıcı sayısı hesaplanamadı') }
        } finally {
          if (alive) setPreviewing(false)
        }
      })()
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [restaurantId, target])

  const canSend = smsDeliveryEnabled && !sending && name.trim().length > 0 && message.trim().length >= 5 && Boolean(preview?.eligibleRecipients)

  async function handleTest() {
    if (!smsDeliveryEnabled) { setError('SMS gönderimi şirket ve provider aktivasyonuna kadar kapalı'); return }
    setTesting(true)
    setError(null)
    setNotice(null)
    try {
      const res = await sendCampaignTestAction(restaurantId, { phone: testPhone, message })
      if ('error' in res) setError(res.error)
      else setNotice('Test SMS gönderildi')
    } catch {
      setError('Test SMS sonucu doğrulanamadı')
    } finally {
      setTesting(false)
    }
  }

  async function handleSend() {
    if (!smsDeliveryEnabled) { setError('SMS gönderimi şirket ve provider aktivasyonuna kadar kapalı'); return }
    setSending(true)
    setError(null)
    setNotice(null)
    const requestId = sendRequestId.current ?? crypto.randomUUID()
    sendRequestId.current = requestId
    try {
      const res = await sendCampaignAction(restaurantId, { requestId, name, message, audience: targetToAudience(target) })
      if ('error' in res) {
        setError(res.error)
        if (res.preview) setPreview(res.preview)
        return
      }
      setPreview(res.preview)
      sendRequestId.current = null
      onSent(res.campaign)
      setNotice(res.replayed ? 'Bu kampanya isteği daha önce güvenle kuyruğa alınmıştı' : 'Kampanya güvenle kuyruğa alındı')
    } catch {
      setError('Kampanya sonucu doğrulanamadı. Aynı istek güvenle yeniden denenebilir.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AccessibleDialog
      labelledBy="customer-campaign-title"
      describedBy="customer-campaign-description"
      onClose={onClose}
      closeDisabled={sending}
      className="customer-campaign-dialog"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,17,19,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="customer-campaign-panel" style={{ width: 'min(940px, 100%)', maxHeight: 'min(760px, 92vh)', overflow: 'hidden', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 300px' }}>
        <div className="customer-campaign-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', maxHeight: 'min(760px, 92vh)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--divider)' }}>
            <div>
              <div id="customer-campaign-title" style={{ fontSize: 16, fontWeight: 750, color: 'var(--text)' }}>SMS kampanyası</div>
              <div id="customer-campaign-description" style={{ ...S.caption, marginTop: 3 }}>Önizleme güncel pazarlama izni ve canonical telefon kurallarını kullanır</div>
            </div>
            <button data-modal-initial-focus type="button" onClick={onClose} disabled={sending} aria-label="Kapat" style={{ ...btnGhost({ width: 44, minWidth: 44, height: 44, padding: 0, justifyContent: 'center' }), flexShrink: 0 }}><I.close size={14} /></button>
          </div>

          <div className="customer-campaign-content" style={{ padding: 18, overflow: 'auto', display: 'grid', gap: 14 }}>
            {!smsDeliveryEnabled && (
              <div role="status" style={{ border: '1px solid var(--warning)', borderRadius: 10, padding: '10px 12px', background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5, lineHeight: 1.45 }}>
                SMS gönderimi şirket ve provider aktivasyonuna kadar kapalı. Hedef kitle önizlemesi kullanılabilir; test veya kampanya gönderilemez.
              </div>
            )}
            <div className="customer-campaign-fields" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Kampanya adı</span>
                <input value={name} onChange={(e) => { sendRequestId.current = null; setName(e.target.value) }} maxLength={80} style={fieldStyle()} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Hedef segment</span>
                <select value={target} onChange={(e) => { sendRequestId.current = null; setTarget(e.target.value as CampaignTargetValue) }} style={fieldStyle()}>
                  <option value="all">Tüm müşteriler</option>
                  {SEGMENTS.filter((sg) => sg.id).map((sg) => <option key={sg.id} value={`builtin:${sg.id}`}>{sg.label}</option>)}
                  {savedSegments.map((sg) => <option key={sg.id} value={`custom:${sg.id}`}>Kayıtlı: {sg.name}</option>)}
                </select>
              </label>
            </div>

            <div className="customer-campaign-audience" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              <AudienceBox label="Segment" value={previewing ? '...' : (preview?.totalCandidates ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Uygun alıcı" value={previewing ? '...' : (preview?.eligibleRecipients ?? 0).toLocaleString('tr-TR')} tone="positive" />
              <AudienceBox label="İzin yok" value={previewing ? '...' : (preview?.skippedNoMarketingConsent ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Telefon yok/geçersiz" value={previewing ? '...' : (preview?.skippedInvalidPhone ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Tekrar telefon" value={previewing ? '...' : (preview?.skippedDuplicatePhone ?? 0).toLocaleString('tr-TR')} />
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={S.label}>Mesaj</span>
              <textarea
                value={message}
                onChange={(e) => { sendRequestId.current = null; setMessage(e.target.value.slice(0, 459)) }}
                rows={5}
                style={{ ...fieldStyle({ height: 'auto', minHeight: 132, padding: 12, resize: 'vertical', lineHeight: 1.5 }) }}
              />
              <span style={{ ...S.caption, textAlign: 'right' }}>{message.length}/459</span>
            </label>

            <div className="customer-campaign-test" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Test telefon</span>
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0555 123 45 67" style={fieldStyle()} />
              </label>
              <button type="button" disabled={!smsDeliveryEnabled || testing || message.trim().length < 5} onClick={() => { void handleTest() }} style={btnGhost({ height: 44, opacity: smsDeliveryEnabled && !testing ? 1 : 0.55 })}>
                <I.phone size={13} />{testing ? 'Gönderiliyor...' : 'Test gönder'}
              </button>
            </div>

            {(error || notice) && (
              <div role={error ? 'alert' : 'status'} aria-live="polite" style={{ borderRadius: 10, padding: '10px 12px', fontSize: 12.5, background: error ? 'var(--critical-bg)' : 'var(--positive-bg)', color: error ? 'var(--critical)' : 'var(--positive)' }}>
                {error ?? notice}
              </div>
            )}
          </div>

          <div className="customer-campaign-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface)' }}>
            <button type="button" onClick={onClose} disabled={sending} style={btnGhost({ height: 44 })}>Kapat</button>
            <button type="button" disabled={!canSend} onClick={() => { void handleSend() }} style={btnPrimary({ height: 44, padding: '0 15px', opacity: canSend ? 1 : 0.52, cursor: canSend ? 'pointer' : 'not-allowed' })}>
              <I.bell size={13} />{sending ? 'Gönderiliyor...' : 'Kampanyayı gönder'}
            </button>
          </div>
        </div>

        <aside className="customer-campaign-history" style={{ borderLeft: '1px solid var(--divider)', background: 'var(--surface-2)', padding: 16, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-3)', letterSpacing: '.05em', marginBottom: 10 }}>SON GÖNDERİMLER</div>
          {campaigns.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>Henüz SMS kampanyası yok.</div>
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {campaigns.map((campaign) => (
                <div key={campaign.id} style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', padding: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaign.name}</div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                    {campaign.sentCount}/{campaign.recipientCount} gönderildi
                    {campaign.failedCount ? ` · ${campaign.failedCount} hata` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      <style>{`@media (max-width:760px){.customer-campaign-dialog{padding:10px!important;align-items:stretch!important}.customer-campaign-panel{grid-template-columns:1fr!important;max-height:calc(100vh - 20px)!important;overflow-y:auto!important}.customer-campaign-main{max-height:none!important}.customer-campaign-content{overflow:visible!important}.customer-campaign-fields,.customer-campaign-test{grid-template-columns:1fr!important}.customer-campaign-audience{grid-template-columns:repeat(2,minmax(0,1fr))!important}.customer-campaign-footer{position:sticky!important;bottom:0!important;z-index:2}.customer-campaign-history{border-left:0!important;border-top:1px solid var(--divider)!important;overflow:visible!important}} @media (max-width:430px){.customer-campaign-audience{grid-template-columns:1fr!important}}`}</style>
    </AccessibleDialog>
  )
}

function AudienceBox({ label, value, tone }: { label: string; value: string; tone?: 'positive' }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: tone === 'positive' ? 'var(--positive-bg)' : 'var(--surface-2)', padding: 12 }}>
      <div style={{ fontSize: 11, color: tone === 'positive' ? 'var(--positive)' : 'var(--text-3)', fontWeight: 700, letterSpacing: '.04em' }}>{label.toLocaleUpperCase('tr-TR')}</div>
      <div style={{ marginTop: 5, fontSize: 22, fontWeight: 780, color: tone === 'positive' ? 'var(--positive)' : 'var(--text)', ...S.mono }}>{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: CampaignSummary['status'] }) {
  const meta = status === 'sent'
    ? { label: 'Gönderildi', bg: 'var(--positive-bg)', fg: 'var(--positive)' }
    : status === 'failed'
      ? { label: 'Hata', bg: 'var(--critical-bg)', fg: 'var(--critical)' }
      : status === 'sending'
        ? { label: 'Gönderiliyor', bg: 'var(--warning-bg)', fg: 'var(--warning)' }
        : { label: status, bg: 'var(--surface-3)', fg: 'var(--text-3)' }
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px', background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}>{meta.label}</span>
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 10px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    fontSize: 12.5,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}

function segmentIconBtn(active: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    border: 'none',
    borderLeft: active ? '1px solid rgba(255,255,255,.2)' : '1px solid var(--divider)',
    background: 'transparent',
    color: active ? '#fff' : 'var(--text-3)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}

type RuleKey = 'last_seen_days' | 'visits' | 'spend' | 'points' | 'lifetime_points'
type SegmentEditorState =
  | { mode: 'create'; name: string; definition: CustomerSegmentDefinition }
  | { mode: 'edit'; segmentId: string; name: string; definition: CustomerSegmentDefinition }

const RULES: Array<{ key: RuleKey; label: string; unit?: string; integer?: boolean }> = [
  { key: 'last_seen_days', label: 'Son görülme', unit: 'gün', integer: true },
  { key: 'visits', label: 'Ziyaret', integer: true },
  { key: 'spend', label: 'Harcama' },
  { key: 'points', label: 'Puan', integer: true },
  { key: 'lifetime_points', label: 'Lifetime puan', integer: true },
]

function definitionFromBuiltIn(segment: string): CustomerSegmentDefinition {
  if (segment === 'frequent') return { visits: { op: '>=', value: 3 } }
  if (segment === 'lapsed') return { last_seen_days: { op: '>=', value: 60 } }
  if (segment === 'consented') return { consent: 'granted' }
  return {}
}

function describeDefinition(definition: CustomerSegmentDefinition): string {
  const parts: string[] = []
  if (definition.consent === 'granted') parts.push('Rıza var')
  if (definition.consent === 'missing') parts.push('Rıza yok')
  for (const rule of RULES) {
    const value = definition[rule.key]
    if (!value) continue
    if (rule.key === 'last_seen_days') parts.push(value.op === '<=' ? `Son ${value.value} gün` : `${value.value}+ gündür yok`)
    else {
      const rendered = rule.key === 'spend' ? formatCurrency(value.value) : String(value.value)
      parts.push(`${rule.label} ${value.op} ${rendered}`)
    }
  }
  return parts.length ? parts.join(' · ') : 'Tüm müşteriler'
}

function pruneDefinition(definition: CustomerSegmentDefinition): CustomerSegmentDefinition {
  const out: CustomerSegmentDefinition = {}
  if (definition.consent === 'granted' || definition.consent === 'missing') out.consent = definition.consent
  for (const rule of RULES) {
    const value = definition[rule.key]
    if (!value || !Number.isFinite(value.value) || value.value < 0) continue
    out[rule.key] = { op: value.op, value: rule.integer ? Math.floor(value.value) : Math.round(value.value * 100) / 100 }
  }
  return out
}

function SegmentEditorModal({
  state,
  saving,
  error,
  onClose,
  onSave,
}: {
  state: SegmentEditorState
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (input: { name: string; definition: CustomerSegmentDefinition }) => void | Promise<void>
}) {
  const [name, setName] = useState(state.name)
  const [definition, setDefinition] = useState<CustomerSegmentDefinition>(state.definition)

  function setRule(key: RuleKey, enabled: boolean) {
    setDefinition((prev) => {
      const next = { ...prev }
      if (enabled) next[key] = prev[key] ?? { op: key === 'last_seen_days' ? '<=' : '>=', value: 0 }
      else delete next[key]
      return next
    })
  }

  function updateRule(key: RuleKey, patch: Partial<{ op: '>=' | '<='; value: number }>) {
    setDefinition((prev) => {
      const current = prev[key] ?? { op: key === 'last_seen_days' ? '<=' : '>=', value: 0 }
      return { ...prev, [key]: { ...current, ...patch } }
    })
  }

  const canSave = name.trim().length > 0 && !saving

  return (
    <AccessibleDialog
      labelledBy="customer-segment-editor-title"
      describedBy="customer-segment-editor-description"
      onClose={onClose}
      closeDisabled={saving}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,17,19,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ width: 'min(620px, 100%)', maxHeight: 'min(720px, 92vh)', overflowY: 'auto', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.22)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--divider)' }}>
          <div>
            <div id="customer-segment-editor-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{state.mode === 'edit' ? 'Segmenti düzenle' : 'Segment kaydet'}</div>
            <div id="customer-segment-editor-description" style={{ ...S.caption, marginTop: 3 }}>{describeDefinition(pruneDefinition(definition))}</div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Kapat" style={{ ...btnGhost({ width: 44, height: 44, padding: 0, justifyContent: 'center' }) }}><I.close size={14} /></button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={S.label}>Segment adı</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={fieldStyle()} placeholder="Örn. VIP geri kazanım" />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={S.label}>İletişim izni</span>
            <select value={definition.consent ?? ''} onChange={(e) => setDefinition((prev) => {
              const next = { ...prev }
              if (e.target.value === 'granted' || e.target.value === 'missing') next.consent = e.target.value
              else delete next.consent
              return next
            })} style={fieldStyle()}>
              <option value="">Farketmez</option>
              <option value="granted">Rıza var</option>
              <option value="missing">Rıza yok</option>
            </select>
          </label>

          <div style={{ display: 'grid', gap: 8 }}>
            {RULES.map((rule) => {
              const active = Boolean(definition[rule.key])
              const value = definition[rule.key] ?? { op: rule.key === 'last_seen_days' ? '<=' : '>=', value: 0 }
              return (
                <div key={rule.key} className="customer-segment-rule" style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) 84px minmax(120px, 1fr)', gap: 8, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <label style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
                    <input type="checkbox" checked={active} onChange={(e) => setRule(rule.key, e.target.checked)} />
                    {rule.label}
                  </label>
                  <select disabled={!active} value={value.op} onChange={(e) => updateRule(rule.key, { op: e.target.value as '>=' | '<=' })} style={fieldStyle({ opacity: active ? 1 : 0.45 })}>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input disabled={!active} type="number" min={0} step={rule.integer ? 1 : 0.01} value={value.value} onChange={(e) => updateRule(rule.key, { value: Number(e.target.value) })} style={fieldStyle({ opacity: active ? 1 : 0.45, width: '100%' })} />
                    {rule.unit && <span style={{ ...S.caption, minWidth: 28 }}>{rule.unit}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <div role="alert" style={{ color: 'var(--critical)', fontSize: 12.5 }}>{error}</div>}
        </div>

        <div style={{ position: 'sticky', bottom: 0, zIndex: 1, background: 'var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--divider)' }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnGhost({ height: 44 })}>İptal</button>
          <button type="button" disabled={!canSave} onClick={() => { void onSave({ name: name.trim(), definition: pruneDefinition(definition) }) }} style={btnPrimary({ height: 44, opacity: canSave ? 1 : 0.55, cursor: canSave ? 'pointer' : 'not-allowed' })}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 560px) { .customer-segment-rule { grid-template-columns: 1fr !important; } }`}</style>
    </AccessibleDialog>
  )
}

function fieldStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    height: 44,
    padding: '0 12px',
    borderRadius: 9,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13.5,
    outline: 'none',
    ...overrides,
  }
}
