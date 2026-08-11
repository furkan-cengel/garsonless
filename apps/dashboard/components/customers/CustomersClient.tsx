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
import { I, S } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'
import { useShell } from '../../lib/shell-context'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title="Müşteriler" tag={<Badge variant="secondary">{initialSegmentCounts.all} müşteri</Badge>} />

      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-page-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
          <div className="customer-list-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.025em', margin: 0 }}>Müşteriler</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '5px 0 0' }}>Üyeler, sadakat bakiyeleri ve ziyaret geçmişi</p>
            </div>
            <div className="customer-page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canManageCampaigns && <Button type="button" variant="outline" size="sm" onClick={() => setCampaignOpen(true)}>
                <I.bell size={14} />SMS kampanyası
              </Button>}
              <Button type="button" size="sm" onClick={openCreateFromCurrent}>
                <I.plus size={13} />Filtreyi kaydet
              </Button>
            </div>
          </div>

          {!canManageCampaigns && (
            <Alert className="mb-5" role="status">
              <I.lock size={16} />
              <AlertDescription>İletişim bilgileri güvenlik nedeniyle maskeli gösterilir. SMS kampanyası ve manuel puan/bakiye düzenlemeleri yalnız işletme sahibine açıktır.</AlertDescription>
            </Alert>
          )}

          {listError && (
            <Alert variant="destructive" aria-live="polite" className="mb-4 pr-28">
              <I.warn size={16} />
              <AlertDescription>{listError}</AlertDescription>
              <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => setListRetry((value) => value + 1)}>Yeniden dene</Button></AlertAction>
            </Alert>
          )}

          <div className="customer-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
            <MiniStat label="Toplam müşteri" value={initialSegmentCounts.all.toLocaleString('tr-TR')} icon={<I.users size={15} />} />
            <MiniStat label="İletişim izinli" value={initialSegmentCounts.consented.toLocaleString('tr-TR')} icon={<I.check size={15} />} sub={`Tüm müşterilerin %${initialSegmentCounts.all ? Math.round((initialSegmentCounts.consented / initialSegmentCounts.all) * 100) : 0}'i`} />
            <MiniStat label="Sık gelen" value={initialSegmentCounts.frequent.toLocaleString('tr-TR')} icon={<I.star size={15} />} sub="En az 3 ziyaret" />
            <MiniStat label="Geri kazanılacak" value={initialSegmentCounts.lapsed.toLocaleString('tr-TR')} icon={<I.clock size={15} />} sub="60+ gündür gelmeyen" />
          </div>

          <div className="customer-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <InputGroup className="customer-search h-9 flex-1 bg-card shadow-xs">
              <InputGroupAddon><I.search size={16} /></InputGroupAddon>
              <InputGroupInput
                aria-label="Müşteri ara"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Ad veya telefon sonu (örn. 67)"
              />
              {search && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Aramayı temizle" onClick={() => { setSearch(''); setPage(1) }}><I.close size={13} /></InputGroupButton></InputGroupAddon>}
            </InputGroup>
            <Field orientation="horizontal" className="w-auto items-center">
              <FieldLabel className="text-muted-foreground">Sırala</FieldLabel>
              <Select
                value={sort}
                onValueChange={(value) => { if (value) setSort(value as CustomerSort); setPage(1) }}
              >
                <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>{SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <ToggleGroup
            value={!customSegmentId ? [segment || 'all'] : []}
            onValueChange={(values) => { const next = values[0]; if (next) applyBuiltInSegment(next === 'all' ? '' : next as CustomerSegment) }}
            variant="outline"
            size="sm"
            className="mb-4 flex w-full flex-wrap justify-start"
            aria-label="Müşteri segmenti"
          >
            {SEGMENTS.map((sg) => (
              <ToggleGroupItem key={sg.id || 'all'} value={sg.id || 'all'} className="rounded-full px-3">
                {sg.label}<Badge variant="secondary" className="ml-1.5">{countForBuiltIn(sg.id)}</Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {savedSegments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-3)', letterSpacing: '.04em' }}>KAYITLI</span>
              {savedSegments.map((saved) => {
                const active = customSegmentId === saved.id
                return (
                  <span key={saved.id} className="customer-saved-segment" data-active={active} style={{ display: 'inline-flex', alignItems: 'center', height: 34, borderRadius: 99, border: `1px solid ${active ? 'var(--action)' : 'var(--border)'}`, background: active ? 'var(--action)' : 'var(--surface)', overflow: 'hidden', boxShadow: active ? 'none' : 'var(--shadow-1)' }}>
                    <Button type="button" variant="ghost" size="xs" className="customer-saved-segment-label rounded-none" aria-pressed={active} onClick={() => applySavedSegment(saved.id)} title={describeDefinition(saved.definition)}>
                      {saved.name}
                    </Button>
                    <Button type="button" variant="ghost" size="icon-xs" className="customer-saved-segment-icon rounded-none" onClick={() => openEditSegment(saved)} aria-label={`${saved.name} düzenle`}><I.gear size={12} /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" className="customer-saved-segment-icon customer-saved-segment-delete rounded-none" onClick={() => setSegmentToDelete(saved)} aria-label={`${saved.name} sil`}><I.trash size={12} /></Button>
                  </span>
                )
              })}
            </div>
          )}

          {canManageCampaigns && campaigns.length > 0 && (
            <CampaignStrip campaigns={campaigns.slice(0, 3)} onOpen={() => setCampaignOpen(true)} />
          )}

          {segmentError && <Alert variant="destructive" className="mb-3"><AlertDescription>{segmentError}</AlertDescription></Alert>}

          <Card className="customer-table relative gap-0 py-0" aria-busy={pending} style={{ opacity: pending ? 0.72 : 1 }}>
            {pending && <Badge variant="secondary" className="absolute right-3 top-3 z-10 gap-1.5"><Spinner className="size-3" />Güncelleniyor</Badge>}
            <Table className="min-w-[900px]">
              <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">MÜŞTERİ</TableHead><TableHead>TELEFON</TableHead><TableHead>SEVİYE</TableHead><TableHead className="text-right">ZİYARET</TableHead><TableHead className="text-right">HARCAMA</TableHead><TableHead className="text-right">PUAN</TableHead><TableHead className="pr-5 text-right">SON GÖRÜLME</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.customers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0">
                    <Empty className="min-h-56">
                      <EmptyHeader><EmptyMedia variant="icon"><I.users size={18} /></EmptyMedia><EmptyTitle>Eşleşen müşteri yok</EmptyTitle><EmptyDescription>Arama veya segment ölçütlerini değiştirin.</EmptyDescription></EmptyHeader>
                      {hasActiveFilters && <EmptyContent><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Filtreleri temizle</Button></EmptyContent>}
                    </Empty>
                  </TableCell></TableRow>
                ) : data.customers.map((c, i) => (
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
              ))}
              </TableBody>
            </Table>
          </Card>

          <div className="customer-table-scroll-hint" role="status" style={{ display: 'none', marginTop: 8, color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.4 }}>
            Tüm sütunları görmek için tabloyu yatay kaydırın.
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
            {data.total > 0 ? `${data.total} eşleşmeden ${data.customers.length} müşteri gösteriliyor` : 'Gösterilecek müşteri yok'}
          </div>

          {data.total > data.pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Önceki</Button>
              <span>{page} / {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki ›</Button>
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
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MiniStat({ label, value, icon, sub, mono }: { label: string; value: string; icon: ReactNode; sub?: string; mono?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <CardAction className="text-muted-foreground">{icon}</CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight tabular-nums" style={mono ? S.mono : undefined}>{value}</div>
        {sub && <CardDescription className="mt-1 text-xs">{sub}</CardDescription>}
      </CardContent>
    </Card>
  )
}

function CustomerRow({ c, onClick, delay, referenceNow }: { c: RestaurantCustomer; onClick: () => void; delay: number; referenceNow: string }) {
  const tags = tagsForCustomer(c, referenceNow)
  const soft = softForTier(c.tier.color)
  return (
    <TableRow
      className="customer-row-action cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}
      style={{
        animation: 'rowIn 300ms ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      <TableCell className="pl-5">
        <div className="flex min-w-0 items-center gap-3">
        <Avatar size="lg"><AvatarFallback style={{ background: soft, color: c.tier.color }}>{initials(c.name)}</AvatarFallback></Avatar>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || 'İsimsiz'}</div>
          {tags.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
        </div>
        </div>
      </TableCell>
      <TableCell><span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...S.mono }}>
        <span style={{ fontSize: 13, color: c.phoneMasked ? 'var(--text-3)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone}</span>
        <span style={{ fontSize: 11, color: c.emailMasked ? 'var(--text-4)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
      </span></TableCell>
      <TableCell>
        <Badge variant="secondary" style={{ color: c.tier.color, background: soft }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: c.tier.color }} />{c.tier.name}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{c.visits}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatCurrency(c.spend)}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums text-amber-700">{c.points}</TableCell>
      <TableCell className="pr-5 text-right text-muted-foreground"><span className="inline-flex items-center gap-2">{relTime(c.lastSeen, referenceNow)}<I.chevRight size={11} /></span></TableCell>
    </TableRow>
  )
}

function CampaignStrip({ campaigns, onOpen }: { campaigns: CampaignSummary[]; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onOpen}
      className="customer-campaign-strip mb-4 h-auto w-full justify-start gap-3 rounded-xl p-3 text-left"
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
    </Button>
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
    <Dialog open onOpenChange={(open) => { if (!open && !sending) onClose() }}>
      <DialogContent showCloseButton={!sending} className="customer-campaign-dialog max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-[940px]">
      <div className="customer-campaign-panel" style={{ overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 300px' }}>
        <div className="customer-campaign-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', maxHeight: 'min(760px, 92vh)' }}>
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle id="customer-campaign-title">SMS kampanyası</DialogTitle>
            <DialogDescription id="customer-campaign-description">Önizleme güncel pazarlama izni ve canonical telefon kurallarını kullanır.</DialogDescription>
          </DialogHeader>

          <div className="customer-campaign-content" style={{ padding: 18, overflow: 'auto', display: 'grid', gap: 14 }}>
            {!smsDeliveryEnabled && (
              <Alert role="status" className="border-warning/30 bg-warning/10 text-warning"><I.warn size={16} /><AlertDescription className="text-inherit">SMS gönderimi şirket ve provider aktivasyonuna kadar kapalı. Hedef kitle önizlemesi kullanılabilir; test veya kampanya gönderilemez.</AlertDescription></Alert>
            )}
            <div className="customer-campaign-fields" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Field><FieldLabel htmlFor="customer-campaign-name">Kampanya adı</FieldLabel><Input id="customer-campaign-name" value={name} onChange={(e) => { sendRequestId.current = null; setName(e.target.value) }} maxLength={80} /></Field>
              <Field><FieldLabel>Hedef segment</FieldLabel>
                <Select value={target} onValueChange={(value) => { if (value) { sendRequestId.current = null; setTarget(value as CampaignTargetValue) } }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm müşteriler</SelectItem>
                    {SEGMENTS.filter((sg) => sg.id).map((sg) => <SelectItem key={sg.id} value={`builtin:${sg.id}`}>{sg.label}</SelectItem>)}
                    {savedSegments.map((sg) => <SelectItem key={sg.id} value={`custom:${sg.id}`}>Kayıtlı: {sg.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="customer-campaign-audience" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              <AudienceBox label="Segment" value={previewing ? '...' : (preview?.totalCandidates ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Uygun alıcı" value={previewing ? '...' : (preview?.eligibleRecipients ?? 0).toLocaleString('tr-TR')} tone="positive" />
              <AudienceBox label="İzin yok" value={previewing ? '...' : (preview?.skippedNoMarketingConsent ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Telefon yok/geçersiz" value={previewing ? '...' : (preview?.skippedInvalidPhone ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Tekrar telefon" value={previewing ? '...' : (preview?.skippedDuplicatePhone ?? 0).toLocaleString('tr-TR')} />
            </div>

            <Field>
              <FieldLabel htmlFor="customer-campaign-message">Mesaj</FieldLabel>
              <Textarea id="customer-campaign-message"
                value={message}
                onChange={(e) => { sendRequestId.current = null; setMessage(e.target.value.slice(0, 459)) }}
                rows={5}
                className="min-h-32"
              />
              <FieldDescription className="text-right tabular-nums">{message.length}/459</FieldDescription>
            </Field>

            <div className="customer-campaign-test" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
              <Field><FieldLabel htmlFor="customer-test-phone">Test telefon</FieldLabel><Input id="customer-test-phone" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0555 123 45 67" /></Field>
              <Button type="button" variant="outline" disabled={!smsDeliveryEnabled || testing || message.trim().length < 5} onClick={() => { void handleTest() }}>
                {testing ? <Spinner /> : <I.phone size={13} />}{testing ? 'Gönderiliyor...' : 'Test gönder'}
              </Button>
            </div>

            {(error || notice) && (
              <Alert variant={error ? 'destructive' : 'default'} role={error ? 'alert' : 'status'} aria-live="polite"><AlertDescription>{error ?? notice}</AlertDescription></Alert>
            )}
          </div>

          <div className="customer-campaign-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface)' }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Kapat</Button>
            <Button type="button" disabled={!canSend} onClick={() => { void handleSend() }}>
              {sending ? <Spinner /> : <I.bell size={13} />}{sending ? 'Gönderiliyor...' : 'Kampanyayı gönder'}
            </Button>
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
      <style>{`@media (max-width:760px){.customer-campaign-dialog{max-height:calc(100dvh - 20px)!important}.customer-campaign-panel{grid-template-columns:1fr!important;overflow-y:auto!important}.customer-campaign-main{max-height:none!important}.customer-campaign-content{overflow:visible!important}.customer-campaign-fields,.customer-campaign-test{grid-template-columns:1fr!important}.customer-campaign-audience{grid-template-columns:repeat(2,minmax(0,1fr))!important}.customer-campaign-footer{position:sticky!important;bottom:0!important;z-index:2}.customer-campaign-history{border-left:0!important;border-top:1px solid var(--divider)!important;overflow:visible!important}} @media (max-width:430px){.customer-campaign-audience{grid-template-columns:1fr!important}}`}</style>
      </DialogContent>
    </Dialog>
  )
}

function AudienceBox({ label, value, tone }: { label: string; value: string; tone?: 'positive' }) {
  return (
    <Card size="sm" className={tone === 'positive' ? 'bg-emerald-50 text-emerald-800' : 'bg-muted/40'}>
      <CardHeader><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-xl font-semibold tabular-nums" style={S.mono}>{value}</div></CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status: CampaignSummary['status'] }) {
  const meta = status === 'sent'
    ? { label: 'Gönderildi', variant: 'positive' as const }
    : status === 'failed'
      ? { label: 'Hata', variant: 'destructive' as const }
      : status === 'sending'
        ? { label: 'Gönderiliyor', variant: 'warning' as const }
        : { label: status, variant: 'secondary' as const }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
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
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent showCloseButton={!saving} className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[620px]">
        <DialogHeader className="sticky top-0 z-10 border-b bg-popover px-5 py-4 pr-12">
          <DialogTitle id="customer-segment-editor-title">{state.mode === 'edit' ? 'Segmenti düzenle' : 'Segment kaydet'}</DialogTitle>
          <DialogDescription id="customer-segment-editor-description">{describeDefinition(pruneDefinition(definition))}</DialogDescription>
        </DialogHeader>

        <FieldGroup className="p-4">
          <Field><FieldLabel htmlFor="customer-segment-name">Segment adı</FieldLabel><Input id="customer-segment-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Örn. VIP geri kazanım" /></Field>

          <Field><FieldLabel>İletişim izni</FieldLabel>
            <Select value={definition.consent ?? 'any'} onValueChange={(selected) => setDefinition((prev) => {
              const next = { ...prev }
              if (selected === 'granted' || selected === 'missing') next.consent = selected
              else delete next.consent
              return next
            })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="any">Farketmez</SelectItem><SelectItem value="granted">Rıza var</SelectItem><SelectItem value="missing">Rıza yok</SelectItem></SelectContent>
            </Select>
          </Field>

          <div style={{ display: 'grid', gap: 8 }}>
            {RULES.map((rule) => {
              const active = Boolean(definition[rule.key])
              const value = definition[rule.key] ?? { op: rule.key === 'last_seen_days' ? '<=' : '>=', value: 0 }
              return (
                <Card key={rule.key} size="sm" className="customer-segment-rule grid grid-cols-[minmax(130px,1fr)_84px_minmax(120px,1fr)] items-center gap-2 p-2">
                  <label className="flex min-h-8 items-center gap-2 text-sm">
                    <Checkbox checked={active} onCheckedChange={(checked) => setRule(rule.key, checked)} />
                    {rule.label}
                  </label>
                  <Select disabled={!active} value={value.op} onValueChange={(selected) => { if (selected) updateRule(rule.key, { op: selected as '>=' | '<=' }) }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent>
                  </Select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input disabled={!active} type="number" min={0} step={rule.integer ? 1 : 0.01} value={value.value} onChange={(e) => updateRule(rule.key, { value: Number(e.target.value) })} />
                    {rule.unit && <span style={{ ...S.caption, minWidth: 28 }}>{rule.unit}</span>}
                  </div>
                </Card>
              )
            })}
          </div>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </FieldGroup>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-popover p-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>İptal</Button>
          <Button type="button" disabled={!canSave} onClick={() => { void onSave({ name: name.trim(), definition: pruneDefinition(definition) }) }}>
            {saving && <Spinner />}{saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      <style>{`@media (max-width: 560px) { .customer-segment-rule { grid-template-columns: 1fr !important; } }`}</style>
      </DialogContent>
    </Dialog>
  )
}
