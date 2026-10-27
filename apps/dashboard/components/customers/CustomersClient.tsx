'use client'

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
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import type {
  CampaignSummary,
  SavedCampaignEmailTemplate
} from '@garsonless/domain/campaigns'
import {
  type CustomerSegment,
  type CustomerSegmentCounts,
  type CustomerSegmentDefinition,
  type CustomerSort,
  type RestaurantCustomer,
  type RestaurantCustomersPage,
  type SavedCustomerSegment,
} from '@garsonless/domain/customers'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import {
  createCustomerSegmentAction,
  deleteCustomerSegmentAction,
  listCustomers,
  loadCustomerPageSupportAction,
  updateCustomerSegmentAction,
} from '../../lib/actions/customers'
import { I, S } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import PageTopBar from '../layout/PageTopBar'
import { DashboardDraftProvider, useDashboardDraft, useDashboardDrafts } from '../overlays/DashboardDraftProvider'
import {
  customerListHref,
  parseCustomerListState,
  type CustomerListState,
} from './customer-list-state'
import { duplicateNameKey, initials, relTime, softForTier, tagsForCustomer, VIP_HINT } from './customer-profile-model'
import { savedFilterLimitation } from './customer-save-policy'


const SEGMENTS: { id: CustomerSegment | ''; label: string; sub: string; icon: ReactNode; ownerOnly?: boolean }[] = [
  { id: '', label: 'Tüm müşteriler', sub: 'Kayıtlı her müşteri', icon: <I.users size={15} /> },
  { id: 'new', label: 'Yeni', sub: 'Son 30 günde ilk kez geldi', icon: <I.plus size={15} /> },
  { id: 'frequent', label: 'Sık gelen', sub: 'En az 3 ziyaret', icon: <I.star size={15} /> },
  { id: 'lapsed', label: 'Geri kazanılacak', sub: '60+ gündür gelmeyen', icon: <I.clock size={15} /> },
  { id: 'consented', label: 'İletişim izinli', sub: 'Kampanya gönderilebilir', icon: <I.mail size={15} />, ownerOnly: true },
]
const CampaignModal = dynamic(() => import('./CustomerCampaignModal'), {
  loading: () => <Dialog open><DialogContent showCloseButton={false}><DialogTitle>E-posta kampanyası</DialogTitle><DialogDescription role="status">Kampanya hazırlanıyor…</DialogDescription><Spinner aria-hidden="true" /></DialogContent></Dialog>,
})
// The profile only loads once a customer is chosen, so it stays out of the list's first paint.
const CustomerProfilePanel = dynamic(() => import('./CustomerProfilePanel'), {
  loading: () => <div role="status" className="customer-profile-placeholder"><Spinner aria-hidden="true" />Profil yükleniyor…</div>,
})
const SORTS: { id: CustomerSort; label: string; ownerOnly?: boolean }[] = [
  { id: 'last_seen', label: 'Son görülme' },
  { id: 'spend', label: 'En çok harcayan', ownerOnly: true },
  { id: 'visits', label: 'En çok ziyaret' },
  { id: 'points', label: 'En yüksek puan' },
  { id: 'joined', label: 'İlk aktivite' },
]
const WIDE_LAYOUT_QUERY = '(min-width: 1180px)'

/** Three columns need room; below this width the profile opens as a sheet over the list. */
function useWideLayout(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => {
    const query = window.matchMedia(WIDE_LAYOUT_QUERY)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

function CustomersClientContent({
  restaurantId,
  restaurantName,
  initial,
  isOwner,
  viewerId,
  emailDeliveryEnabled,
  campaignReplyToEmail,
  resendWebhookEnabled,
  initialState,
  referenceNow,
}: {
  restaurantId: string
  restaurantName: string
  initial: RestaurantCustomersPage
  isOwner: boolean
  viewerId: string
  emailDeliveryEnabled: boolean
  campaignReplyToEmail: string | null
  resendWebhookEnabled: boolean
  initialState: CustomerListState
  referenceNow: string
}) {
  const pathname = usePathname()
  const wide = useWideLayout()
  const [data, setData] = useState<RestaurantCustomersPage>(initial)
  const [segmentCounts, setSegmentCounts] = useState<CustomerSegmentCounts | null>(null)
  const [savedSegments, setSavedSegments] = useState<SavedCustomerSegment[]>([])
  const [search, setSearch] = useState(initialState.search)
  const [segment, setSegment] = useState<CustomerSegment | ''>(initialState.segment)
  const [customSegmentId, setCustomSegmentId] = useState<string | null>(initialState.customSegmentId)
  const [sort, setSort] = useState<CustomerSort>(initialState.sort)
  const [page, setPage] = useState(initial.page)
  const [selectedId, setSelectedId] = useState<string | null>(initialState.customerId)
  const [editor, setEditor] = useState<SegmentEditorState | null>(null)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [emailTemplates, setEmailTemplates] = useState<SavedCampaignEmailTemplate[]>([])
  const [supportLoading, setSupportLoading] = useState(true)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [supportRetry, setSupportRetry] = useState(0)
  const [segmentError, setSegmentError] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)
  const segmentOperation = useRef(false)
  const [deletingSegment, setDeletingSegment] = useState(false)
  useDashboardDraft(false, deletingSegment, () => {})
  const [segmentToDelete, setSegmentToDelete] = useState<SavedCustomerSegment | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [listRetry, setListRetry] = useState(0)
  const [pending, startTransition] = useTransition()
  const firstRender = useRef(true)
  const requestSequence = useRef(0)
  const supportRequest = useRef<{
    restaurantId: string
    retry: number
    promise: ReturnType<typeof loadCustomerPageSupportAction>
  } | null>(null)

  useEffect(() => {
    let active = true
    setSupportLoading(true)
    setSupportError(null)
    if (!supportRequest.current
      || supportRequest.current.restaurantId !== restaurantId
      || supportRequest.current.retry !== supportRetry) {
      supportRequest.current = {
        restaurantId,
        retry: supportRetry,
        promise: loadCustomerPageSupportAction(restaurantId),
      }
    }
    void supportRequest.current.promise.then((result) => {
      if (!active) return
      setSupportLoading(false)
      if ('error' in result) {
        setSupportError(result.error)
        return
      }
      setSegmentCounts(result.segmentCounts)
      setSavedSegments(result.segments)
      setCampaigns(result.campaigns)
      setEmailTemplates(result.emailTemplates)
    }).catch(() => {
      if (!active) return
      setSupportLoading(false)
      setSupportError('Müşteri özetleri yüklenemedi')
    })
    return () => { active = false }
  }, [restaurantId, supportRetry])

  // The open profile lives in the URL so a reload or a shared link keeps it.
  useEffect(() => {
    const href = customerListHref(pathname, { search, segment, customSegmentId, sort, page, customerId: selectedId })
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, '', href)
    }
  }, [pathname, search, segment, customSegmentId, sort, page, selectedId])

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const sequence = ++requestSequence.current
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await listCustomers(restaurantId, { search, segment, customSegmentId, sort, page })
          if (sequence !== requestSequence.current) return
          if ('error' in res) setListError(res.error)
          else {
            setData(res)
            setPage(res.page)
            setListError(null)
          }
        } catch {
          if (sequence === requestSequence.current) {
            setListError('Müşteriler yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.')
          }
        }
      })
    }, 250)
    return () => { clearTimeout(t); requestSequence.current += 1 }
  }, [restaurantId, search, segment, customSegmentId, sort, page, listRetry])

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
      setSelectedId(restored.customerId)
    }
    window.addEventListener('popstate', restoreUrlState)
    return () => window.removeEventListener('popstate', restoreUrlState)
  }, [])

  const visibleSegments = SEGMENTS.filter((sg) => isOwner || !sg.ownerOnly)
  const visibleSorts = SORTS.filter((option) => isOwner || !option.ownerOnly)
  const globalTotal = segmentCounts?.total ?? null
  const saveFilterWarning = savedFilterLimitation(search, segment)
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const activeSavedSegment = customSegmentId
    ? savedSegments.find((sg) => sg.id === customSegmentId) ?? null
    : null
  const activeBuiltIn = SEGMENTS.find((sg) => sg.id === segment) ?? SEGMENTS[0]!
  const listTitle = activeSavedSegment?.name ?? activeBuiltIn.label
  const listRule = activeSavedSegment ? describeDefinition(activeSavedSegment.definition) : activeBuiltIn.sub
  const hasActiveFilters = Boolean(search.trim() || segment || customSegmentId)

  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const customer of data.customers) {
      const key = duplicateNameKey(customer.name)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [data.customers])
  const duplicatesOf = (customer: Pick<RestaurantCustomer, 'name'>) => {
    const key = duplicateNameKey(customer.name)
    return key ? (duplicateCounts.get(key) ?? 1) - 1 : 0
  }
  const selected = selectedId ? data.customers.find((customer) => customer.customerId === selectedId) ?? null : null
  const selectedDuplicates = selected ? duplicatesOf(selected) : 0
  const duplicateNote = selectedDuplicates > 0
    ? `Bu sayfada aynı isimde ${selectedDuplicates} kayıt daha var. Aynı kişi olabilir; ziyaret ve puanlarını karşılaştır.`
    : null

  const handlePointsChanged = useCallback((customerId: string, points: number) => {
    setData((current) => current.customers.some((customer) => customer.customerId === customerId && customer.points !== points)
      ? { ...current, customers: current.customers.map((customer) => customer.customerId === customerId ? { ...customer, points } : customer) }
      : current)
  }, [])

  function countForBuiltIn(id: string): number | string {
    if (id === '') return globalTotal ?? '…'
    if (id === 'new' || id === 'frequent' || id === 'lapsed' || id === 'consented') {
      return segmentCounts?.[id] ?? '…'
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
    if (saveFilterWarning) return
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
      expectedUpdatedAt: saved.updatedAt,
      name: saved.name,
      definition: saved.definition,
    })
  }

  async function handleSaveSegment(input: { name: string; definition: CustomerSegmentDefinition }) {
    if (!editor || segmentOperation.current) return
    segmentOperation.current = true
    setSavingSegment(true)
    setSegmentError(null)
    try {
      const res = editor.mode === 'edit'
        ? await updateCustomerSegmentAction(restaurantId, editor.segmentId, { ...input, expectedUpdatedAt: editor.expectedUpdatedAt })
        : await createCustomerSegmentAction(restaurantId, input)
      if ('error' in res) {
        setSegmentError(res.error)
        if ('code' in res && res.code === 'conflict') setSupportRetry((value) => value + 1)
        return
      }
      setSavedSegments((prev) => editor.mode === 'edit' ? prev.map((sg) => sg.id === res.id ? res : sg) : [...prev, res])
      setCustomSegmentId(res.id)
      setSegment('')
      setPage(1)
      setListRetry((value) => value + 1)
      setEditor(null)
    } catch {
      setSegmentError('Segment kaydedilemedi. Taslağın korundu; yeniden deneyebilirsin.')
    } finally {
      segmentOperation.current = false
      setSavingSegment(false)
    }
  }

  async function handleDeleteSegment(saved: SavedCustomerSegment) {
    if (segmentOperation.current) return
    segmentOperation.current = true
    setDeletingSegment(true)
    setSegmentError(null)
    try {
      const res = await deleteCustomerSegmentAction(restaurantId, saved.id)
      if ('error' in res) { setSegmentError(res.error); return }
      setSavedSegments((prev) => prev.filter((sg) => sg.id !== saved.id))
      if (customSegmentId === saved.id) { setCustomSegmentId(null); setSegment(''); setPage(1) }
      setSegmentToDelete(null)
    } catch {
      setSegmentError('Segment silinemedi. Yeniden deneyebilirsin.')
    } finally {
      segmentOperation.current = false
      setDeletingSegment(false)
    }
  }

  function resetFilters() {
    setSearch('')
    setSegment('')
    setCustomSegmentId(null)
    setSort('last_seen')
    setPage(1)
  }

  const profile = selectedId ? (
    <CustomerProfilePanel
      key={selectedId}
      restaurantId={restaurantId}
      customerId={selectedId}
      isOwner={isOwner}
      viewerId={viewerId}
      referenceNow={referenceNow}
      duplicateNote={duplicateNote}
      onPointsChanged={handlePointsChanged}
      headerAction={wide ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Profili kapat" onClick={() => setSelectedId(null)}><I.close size={14} /></Button> : undefined}
    />
  ) : null

  return (
    <div className="customer-route-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title="Müşteriler" tag={<Badge variant="secondary">{globalTotal ?? '…'} müşteri</Badge>} />

      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-workspace" data-profile-open={Boolean(selectedId)}>
          <aside className="customer-rail" aria-label="Segmentler">
            <h2 className="customer-rail-heading">Hazır segmentler</h2>
            <div className="customer-rail-group" role="group" aria-label="Hazır segmentler">
              {visibleSegments.map((sg) => {
                const value = countForBuiltIn(sg.id)
                const active = !customSegmentId && segment === sg.id
                return (
                  <button key={sg.id || 'all'} type="button" className="customer-segment-filter" aria-pressed={active} onClick={() => applyBuiltInSegment(sg.id)}>
                    <span className="customer-segment-icon" aria-hidden="true">{sg.icon}</span>
                    <span className="customer-segment-text"><strong>{sg.label}</strong><span>{sg.sub}</span></span>
                    {supportLoading && value === '…'
                      ? <span aria-hidden="true" className="h-4 w-6 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                      : <span className="customer-segment-count">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</span>}
                  </button>
                )
              })}
            </div>
            <h2 className="customer-rail-heading customer-rail-heading--saved">Kendi segmentlerin</h2>
            <div className="customer-rail-group" role="group" aria-label="Kendi segmentlerin">
              {savedSegments.length === 0 && !supportLoading && <p className="customer-rail-empty">Filtreleri kaydedip tek tıkla dönebilirsin.</p>}
              {savedSegments.map((saved) => {
                const active = customSegmentId === saved.id
                return (
                  <span key={saved.id} className="customer-saved-segment" data-active={active}>
                    <button type="button" className="customer-segment-filter customer-saved-segment-label" aria-pressed={active} onClick={() => applySavedSegment(saved.id)}>
                      <span className="customer-segment-icon" aria-hidden="true"><I.tag size={15} /></span>
                      <span className="customer-segment-text"><strong>{saved.name}</strong><span>{describeDefinition(saved.definition)}</span></span>
                    </button>
                    <Button type="button" variant="ghost" size="icon-xs" className="customer-saved-segment-icon" onClick={() => openEditSegment(saved)} aria-label={`${saved.name} düzenle`}><I.gear size={12} /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" className="customer-saved-segment-icon customer-saved-segment-delete" onClick={() => { setSegmentError(null); setSegmentToDelete(saved) }} aria-label={`${saved.name} sil`}><I.trash size={12} /></Button>
                  </span>
                )
              })}
              <button type="button" className="customer-new-segment" onClick={openCreateFromCurrent} disabled={Boolean(saveFilterWarning)} title={saveFilterWarning ?? 'Şu anki filtreyi segment olarak kaydet'}>
                <I.plus size={13} aria-hidden="true" />Yeni segment
              </button>
            </div>
          </aside>

          <main className="customer-list-column" aria-label="Müşteri listesi">
            <div className="customer-list-header">
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <h1 className="customer-list-title">{listTitle}</h1>
                <span style={S.caption}>{listRule} · {data.total.toLocaleString('tr-TR')} kişi</span>
              </div>
              <div className="customer-page-actions">
                {isOwner && <Button variant="outline" size="sm" render={<Link href={`/dashboard/${restaurantId}/customers/rewards`} />} nativeButton={false}>
                  <I.gift size={14} />Otomatik ödüller
                </Button>}
                {isOwner && <Button type="button" variant="outline" size="sm" onClick={() => setCampaignOpen(true)}>
                  <I.mail size={14} />E-posta kampanyası
                </Button>}
              </div>
            </div>

            <div className="customer-toolbar">
              <InputGroup className="customer-search h-9 flex-1 bg-card shadow-xs">
                <InputGroupAddon><I.search size={16} /></InputGroupAddon>
                <InputGroupInput
                  aria-label="Müşteri ara"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Ad, e-posta veya telefon"
                />
                {search && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Aramayı temizle" onClick={() => { setSearch(''); setPage(1) }}><I.close size={13} /></InputGroupButton></InputGroupAddon>}
              </InputGroup>
              <Field orientation="horizontal" className="w-auto items-center">
                <FieldLabel className="text-muted-foreground">Sırala</FieldLabel>
                <Select
                  value={sort}
                  onValueChange={(value) => { if (value) setSort(value as CustomerSort); setPage(1) }}
                >
                  <SelectTrigger className="customer-sort-control w-44 bg-card" aria-label="Müşterileri sırala">
                    <SelectValue>{SORTS.find((option) => option.id === sort)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>{visibleSorts.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>

            {saveFilterWarning && <Alert role="status" className="mb-3"><AlertDescription>{saveFilterWarning}</AlertDescription></Alert>}

            {!isOwner && (
              <Alert className="mb-3" role="status">
                <I.lock size={16} />
                <AlertDescription>İletişim bilgileri ve harcamalar yalnız işletme sahibine görünür. Not ekleyebilir, puan ve ziyaretleri görebilirsin.</AlertDescription>
              </Alert>
            )}

            {listError && (
              <Alert variant="destructive" aria-live="polite" className="mb-3 pr-28">
                <I.warn size={16} />
                <AlertDescription>{listError}</AlertDescription>
                <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => setListRetry((value) => value + 1)}>Yeniden dene</Button></AlertAction>
              </Alert>
            )}

            {supportError && (
              <Alert aria-live="polite" className="mb-3 pr-28">
                <I.warn size={16} />
                <AlertDescription>Müşteri listesi hazır; özetler ve kampanya araçları yüklenemedi.</AlertDescription>
                <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => setSupportRetry((value) => value + 1)}>Özetleri yenile</Button></AlertAction>
              </Alert>
            )}

            {isOwner && !supportLoading && campaigns.some((campaign) => campaign.channel === 'email') && (
              <CampaignStrip campaigns={campaigns.filter((campaign) => campaign.channel === 'email').slice(0, 3)} onOpen={() => setCampaignOpen(true)} />
            )}

            {segmentError && !editor && !segmentToDelete && <Alert variant="destructive" className="mb-3"><AlertDescription>{segmentError}</AlertDescription></Alert>}

            <div className="customer-list" role="list" aria-busy={pending} data-owner={isOwner} style={{ opacity: pending ? 0.72 : 1 }}>
              {pending && <div role="status" className="customer-list-update"><Spinner aria-hidden="true" className="size-3" />Güncelleniyor</div>}
              <div className="customer-list-head" aria-hidden="true">
                <span>Müşteri</span><span>Seviye</span><span className="text-right">Puan</span><span className="text-right">Ziyaret</span>
                {isOwner && <span className="text-right">Harcama</span>}
                <span className="text-right">Son görülme</span>
              </div>
              {data.customers.length === 0 ? (
                <Card role="listitem"><Empty className="min-h-56">
                  <EmptyHeader><EmptyMedia variant="icon"><I.users size={18} /></EmptyMedia><EmptyTitle>{hasActiveFilters ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}</EmptyTitle><EmptyDescription>{hasActiveFilters ? 'Arama veya segment ölçütlerini değiştirin.' : 'Müşterileriniz QR menüden hesap oluşturduğunda burada görünür.'}</EmptyDescription></EmptyHeader>
                  {hasActiveFilters && <EmptyContent><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Filtreleri temizle</Button></EmptyContent>}
                </Empty></Card>
              ) : data.customers.map((customer) => (
                <CustomerRow
                  key={customer.customerId}
                  customer={customer}
                  isOwner={isOwner}
                  active={selectedId === customer.customerId}
                  duplicates={duplicatesOf(customer)}
                  referenceNow={referenceNow}
                  onOpen={() => setSelectedId(customer.customerId)}
                />
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
              {data.total > 0 ? `${data.total} eşleşmeden ${data.customers.length} müşteri gösteriliyor · ${VIP_HINT}` : 'Gösterilecek müşteri yok'}
            </div>

            {data.total > data.pageSize && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Önceki</Button>
                <span>{page} / {totalPages}</span>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sonraki ›</Button>
              </div>
            )}
          </main>

          {wide && (
            <aside className="customer-profile-column" aria-label="Müşteri profili">
              {profile ?? <div className="customer-profile-placeholder">Profilini görmek için listeden bir müşteri seç.</div>}
            </aside>
          )}
        </div>
      </div>

      {wide === false && (
        <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
          <SheetContent side="right" className="customer-profile-sheet w-full gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
            <SheetHeader className="sr-only"><SheetTitle>{selected?.name || 'Müşteri profili'}</SheetTitle><SheetDescription>Sadakat, notlar ve hareketler</SheetDescription></SheetHeader>
            {profile}
          </SheetContent>
        </Sheet>
      )}

      {editor && (
        <SegmentEditorModal
          state={editor}
          saving={savingSegment}
          error={segmentError}
          ownerFields={isOwner}
          onClose={() => setEditor(null)}
          onSave={handleSaveSegment}
        />
      )}
      {isOwner && campaignOpen && (
        <CampaignModal
          restaurantId={restaurantId}
          savedSegments={savedSegments}
          campaigns={campaigns.slice(0, 6)}
          emailTemplates={emailTemplates}
          emailDeliveryEnabled={emailDeliveryEnabled}
          restaurantName={restaurantName}
          campaignReplyToEmail={campaignReplyToEmail}
          resendWebhookEnabled={resendWebhookEnabled}
          initialTarget={customSegmentId ? `custom:${customSegmentId}` : segment ? `builtin:${segment}` : 'all'}
          onClose={() => setCampaignOpen(false)}
          onSent={(campaign) => setCampaigns((prev) => [campaign, ...prev.filter((c) => c.id !== campaign.id)])}
          onEmailTemplatesChange={setEmailTemplates}
        />
      )}
      {segmentToDelete && (
        <ConfirmDialog
          title="Segment silinsin mi?"
          description={`“${segmentToDelete.name}” kayıtlı filtresi silinecek. Müşteri verileri etkilenmez.`}
          confirmLabel="Segmenti sil"
          pending={deletingSegment}
          error={segmentError}
          onClose={() => setSegmentToDelete(null)}
          onConfirm={() => { void handleDeleteSegment(segmentToDelete) }}
        />
      )}
      <style>{`
        .customer-page-topbar { position: sticky; top: 0; z-index: 30; }
        .customer-workspace { display: grid; grid-template-columns: 236px minmax(0, 1fr); align-items: start; min-height: calc(100dvh - var(--topbar)); }
        .customer-rail { position: sticky; top: var(--topbar); max-height: calc(100dvh - var(--topbar)); overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 14px 10px; background: var(--surface); border-right: 1px solid var(--border); align-self: stretch; }
        .customer-rail-heading { margin: 0 8px 4px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-2); }
        .customer-rail-heading--saved { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
        .customer-rail-group { display: flex; flex-direction: column; gap: 2px; }
        .customer-rail-empty { margin: 0 8px 4px; font-size: 12px; color: var(--text-2); }
        .customer-segment-filter { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 9px; text-align: left; color: var(--text); background: transparent; transition: background-color 140ms ease; }
        .customer-segment-icon { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--surface-3); color: var(--text-2); }
        .customer-segment-text { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
        .customer-segment-text strong { font-size: 13px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .customer-segment-text span { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .customer-segment-count { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .customer-segment-filter[aria-pressed="true"] { background: var(--surface-3); }
        .customer-segment-filter[aria-pressed="true"] strong { font-weight: 650; }
        .customer-segment-filter[aria-pressed="true"] .customer-segment-icon { background: var(--action); color: #fff; }
        .customer-segment-filter:not(:disabled):hover { background: var(--surface-2); }
        .customer-segment-filter[aria-pressed="true"]:not(:disabled):hover { background: var(--surface-3); filter: brightness(.97); }
        .customer-saved-segment { display: flex; align-items: center; gap: 2px; border-radius: 9px; }
        .customer-saved-segment .customer-saved-segment-label { flex: 1; min-width: 0; }
        .customer-saved-segment-icon { flex: none; opacity: .7; }
        .customer-saved-segment-icon:not(:disabled):hover { background: var(--surface-3) !important; color: var(--text) !important; opacity: 1; }
        .customer-saved-segment-delete:not(:disabled):hover { background: var(--critical-bg) !important; color: var(--critical) !important; }
        .customer-new-segment { min-height: 40px; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px dashed var(--border-strong, var(--text-3)); border-radius: 9px; background: var(--surface); color: var(--text); font-size: 12.5px; font-weight: 600; }
        .customer-new-segment:not(:disabled):hover { background: var(--surface-2); }
        .customer-new-segment:disabled { opacity: .55; cursor: not-allowed; }
        .customer-list-column { min-width: 0; padding: 18px 20px 48px; }
        .customer-list-header { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 12px; margin-bottom: 12px; }
        .customer-list-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
        .customer-page-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .customer-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .customer-list { position: relative; display: flex; flex-direction: column; gap: 2px; transition: opacity 140ms ease; }
        .customer-list-update { position: absolute; right: 8px; top: -2px; z-index: 5; display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-2); font-size: 12px; box-shadow: var(--shadow-1); }
        .customer-list-head, .customer-row-action { display: grid; grid-template-columns: minmax(0, 2.2fr) 96px 72px 64px 104px; align-items: center; gap: 10px; }
        .customer-list[data-owner="true"] .customer-list-head, .customer-list[data-owner="true"] .customer-row-action { grid-template-columns: minmax(0, 2.2fr) 96px 72px 64px 96px 104px; }
        .customer-list-head { padding: 6px 10px; font-size: 11px; font-weight: 650; color: var(--text-2); }
        .customer-row-action { width: 100%; min-height: 56px; padding: 6px 10px; border: 0; border-radius: 10px; text-align: left; color: var(--text); background: transparent; transition: background-color 140ms ease; }
        button.customer-row-action:hover { background: var(--surface-2); }
        .customer-row-action[aria-current="true"] { background: var(--surface-3); }
        .customer-row-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .customer-row-name strong { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .customer-row-sub { display: block; font-size: 11.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .customer-row-num { text-align: right; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12.5px; font-variant-numeric: tabular-nums; }
        .customer-row-mobile-meta { display: none; }
        .customer-dup-badge { flex: none; height: 18px; display: inline-flex; align-items: center; padding: 0 6px; border-radius: 999px; background: var(--warning-bg); color: var(--warning); border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); font-size: 10.5px; font-weight: 650; }
        .customer-campaign-strip { transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease; }
        .customer-campaign-strip:not(:disabled):hover { background: var(--surface-2) !important; border-color: var(--text-3) !important; box-shadow: var(--shadow-2); transform: translateY(-1px); }
        .customer-sort-control:hover { border-color: var(--text-3) !important; }
        .customer-profile-column { position: sticky; top: var(--topbar); max-height: calc(100dvh - var(--topbar)); overflow-y: auto; background: var(--surface); border-left: 1px solid var(--border); align-self: stretch; }
        .customer-profile-placeholder { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 240px; padding: 32px; text-align: center; color: var(--text-2); font-size: 13px; }
        @media ${WIDE_LAYOUT_QUERY} {
          .customer-workspace { grid-template-columns: 236px minmax(0, 1fr) 400px; }
        }
        @media (pointer: coarse) {
          .customer-saved-segment-icon { min-width: 44px !important; min-height: 44px !important; }
          .customer-search { height: 46px !important; }
          .customer-search input, .customer-sort-control { height: 44px !important; }
        }
        @media (max-width: 900px) {
          .customer-workspace { grid-template-columns: minmax(0, 1fr); }
          .customer-rail { position: static; max-height: none; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; gap: 6px; padding: 10px 12px; border-right: 0; border-bottom: 1px solid var(--border); }
          .customer-rail-heading { display: none; }
          .customer-rail-group { flex-direction: row; gap: 6px; }
          .customer-rail-empty { display: none; }
          .customer-segment-filter { width: auto; flex: none; border: 1px solid var(--border); padding: 4px 10px 4px 6px; }
          .customer-segment-text span { display: none; }
          .customer-saved-segment { flex: none; }
          .customer-new-segment { flex: none; margin: 0; padding: 0 12px; min-height: 44px; }
        }
        @media (max-width: 720px) {
          .customer-list-column { padding: 16px 12px 44px; }
          .customer-list-header { align-items: stretch; flex-direction: column; }
          .customer-page-actions { justify-content: stretch; }
          .customer-page-actions > button { flex: 1 1 0; min-height: 44px; }
          .customer-toolbar { align-items: stretch; flex-direction: column; }
          .customer-toolbar label { justify-content: space-between; }
          .customer-search { height: 46px !important; }
          .customer-search input { height: 44px !important; }
          .customer-list-head { display: none; }
          .customer-list { gap: 8px; }
          .customer-row-action, .customer-list[data-owner="true"] .customer-row-action { grid-template-columns: minmax(0, 1fr) auto; padding: 12px; border: 1px solid var(--border); background: var(--surface); }
          .customer-row-cell { display: none; }
          .customer-row-mobile-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .customer-segment-filter, .customer-row-action, .customer-list, .customer-campaign-strip { transition: none !important; transform: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function CustomerRow({ customer, isOwner, active, duplicates, referenceNow, onOpen }: {
  customer: RestaurantCustomer
  isOwner: boolean
  active: boolean
  duplicates: number
  referenceNow: string
  onOpen: () => void
}) {
  const tags = tagsForCustomer(customer, referenceNow)
  const soft = softForTier(customer.tier.color)
  const tierBadge = (
    <Badge variant="secondary" style={{ color: customer.tier.color, background: soft }}>
      <span className="size-1.5 rounded-full" style={{ background: customer.tier.color }} />{customer.tier.name}
    </Badge>
  )
  const lastSeen = relTime(customer.lastSeen, referenceNow)
  return (
    <div role="listitem">
      <button
        type="button"
        className="customer-row-action"
        aria-current={active || undefined}
        aria-label={`${customer.name || 'İsimsiz'}, ${customer.tier.name}, ${customer.points} puan${duplicates > 0 ? ', aynı isimde başka kayıt var' : ''}. Profili aç`}
        onClick={onOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Avatar><AvatarFallback style={{ background: soft, color: customer.tier.color }}>{initials(customer.name)}</AvatarFallback></Avatar>
          <span className="min-w-0">
            <span className="customer-row-name">
              <strong>{customer.name || 'İsimsiz'}</strong>
              {duplicates > 0 && <span className="customer-dup-badge">Aynı isim</span>}
            </span>
            <span className="customer-row-sub" style={S.mono} title={tags.includes('VIP') ? VIP_HINT : undefined}>{customer.phone}{tags.length > 0 ? ` · ${tags.join(' · ')}` : ''}</span>
          </span>
        </span>
        <span className="customer-row-cell">{tierBadge}</span>
        <span className="customer-row-cell customer-row-num" style={{ color: 'var(--warning)', fontWeight: 600 }}>{customer.points.toLocaleString('tr-TR')}</span>
        <span className="customer-row-cell customer-row-num">{customer.visits}</span>
        {isOwner && <span className="customer-row-cell customer-row-num">{customer.spend === null ? '-' : formatCurrency(customer.spend)}</span>}
        <span className="customer-row-cell" style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>{lastSeen}</span>
        <span className="customer-row-mobile-meta">
          {tierBadge}
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{customer.points.toLocaleString('tr-TR')} puan · {lastSeen}</span>
        </span>
      </button>
    </div>
  )
}

function ConfirmDialog({ title, description, confirmLabel, onClose, onConfirm, pending, error }: { title: string; description: string; confirmLabel: string; onClose: () => void; onConfirm: () => void; pending: boolean; error: string | null }) {
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={(event) => { event.preventDefault(); onConfirm() }}>{pending && <Spinner />}{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CampaignStrip({ campaigns, onOpen }: { campaigns: CampaignSummary[]; onOpen: () => void }) {
  const emailCampaigns = campaigns.filter((campaign) => campaign.channel === 'email')
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onOpen}
      className="customer-campaign-strip mb-4 h-auto w-full justify-start gap-3 rounded-xl p-3 text-left"
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        <I.mail size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Son e-posta kampanyaları</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {emailCampaigns.map((c) => `${c.name} (${c.sentCount}/${c.recipientCount})`).join(' · ')}
        </span>
      </span>
      <span style={{ color: 'var(--text-4)' }}><I.chevRight size={14} /></span>
    </Button>
  )
}

type RuleKey = 'last_seen_days' | 'visits' | 'spend' | 'points' | 'lifetime_points'
type SegmentEditorState =
  | { mode: 'create'; name: string; definition: CustomerSegmentDefinition }
  | { mode: 'edit'; segmentId: string; expectedUpdatedAt: string; name: string; definition: CustomerSegmentDefinition }

const RULES: Array<{ key: RuleKey; label: string; unit?: string; integer?: boolean }> = [
  { key: 'last_seen_days', label: 'Son görülme', unit: 'gün', integer: true },
  { key: 'visits', label: 'Ziyaret', integer: true },
  { key: 'spend', label: 'Harcama' },
  { key: 'points', label: 'Puan', integer: true },
  { key: 'lifetime_points', label: 'Ömür boyu puan', integer: true },
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
  ownerFields,
  onClose,
  onSave,
}: {
  state: SegmentEditorState
  saving: boolean
  error: string | null
  /** Spend and consent rules are owner-only; staff build segments from visits, points and recency. */
  ownerFields: boolean
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

  const { requestExit } = useDashboardDrafts()
  const dirty = name !== state.name || JSON.stringify(definition) !== JSON.stringify(state.definition)
  useDashboardDraft(dirty, saving, () => { setName(state.name); setDefinition(state.definition) })
  const requestClose = () => requestExit(onClose)
  const invalidRules = RULES.filter((rule) => {
    const value = definition[rule.key]?.value
    return value !== undefined && (!Number.isFinite(value) || value < 0 || value > 10_000_000 || (rule.integer && !Number.isInteger(value)))
  })
  const canSave = name.trim().length > 0 && !saving && invalidRules.length === 0
  const rules = RULES.filter((rule) => ownerFields || rule.key !== 'spend')

  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogContent showCloseButton={!saving} className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[620px]">
        <DialogHeader className="sticky top-0 z-10 border-b bg-popover px-5 py-4 pr-12">
          <DialogTitle id="customer-segment-editor-title">{state.mode === 'edit' ? 'Segmenti düzenle' : 'Segment kaydet'}</DialogTitle>
          <DialogDescription id="customer-segment-editor-description">{describeDefinition(pruneDefinition(definition))}</DialogDescription>
        </DialogHeader>

        <fieldset disabled={saving} className="min-w-0"><FieldGroup className="p-4">
          <Field><FieldLabel htmlFor="customer-segment-name">Segment adı</FieldLabel><Input id="customer-segment-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Örn. VIP geri kazanım" /></Field>

          {ownerFields && <Field><FieldLabel htmlFor="customer-segment-consent">İletişim izni</FieldLabel>
            <Select disabled={saving} value={definition.consent ?? 'any'} onValueChange={(selected) => setDefinition((prev) => {
              const next = { ...prev }
              if (selected === 'granted' || selected === 'missing') next.consent = selected
              else delete next.consent
              return next
            })}>
              <SelectTrigger id="customer-segment-consent" className="w-full"><SelectValue>{definition.consent === 'granted' ? 'Rıza var' : definition.consent === 'missing' ? 'Rıza yok' : 'Fark etmez'}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="any">Fark etmez</SelectItem><SelectItem value="granted">Rıza var</SelectItem><SelectItem value="missing">Rıza yok</SelectItem></SelectContent>
            </Select>
          </Field>}

          <div style={{ display: 'grid', gap: 8 }}>
            {rules.map((rule) => {
              const active = Boolean(definition[rule.key])
              const value = definition[rule.key] ?? { op: rule.key === 'last_seen_days' ? '<=' : '>=', value: 0 }
              return (
                <Card key={rule.key} size="sm" className="customer-segment-rule grid grid-cols-[minmax(130px,1fr)_84px_minmax(120px,1fr)] items-center gap-2 p-2">
                  <label className="flex min-h-8 items-center gap-2 text-sm">
                    <Checkbox checked={active} disabled={saving} onCheckedChange={(checked) => setRule(rule.key, checked)} />
                    {rule.label}
                  </label>
                  <Select disabled={!active || saving} value={value.op} onValueChange={(selected) => { if (selected) updateRule(rule.key, { op: selected as '>=' | '<=' }) }}>
                    <SelectTrigger className="w-full" aria-label={`${rule.label} karşılaştırması`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value=">=">&gt;=</SelectItem><SelectItem value="<=">&lt;=</SelectItem></SelectContent>
                  </Select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Input aria-invalid={invalidRules.some((invalid) => invalid.key === rule.key) || undefined} aria-describedby={invalidRules.some((invalid) => invalid.key === rule.key) ? "segment-rule-error" : undefined} aria-label={`${rule.label} değeri`} disabled={!active} type="number" min={0} step={rule.integer ? 1 : 0.01} value={value.value} onChange={(e) => updateRule(rule.key, { value: Number(e.target.value) })} />
                    {rule.unit && <span style={{ ...S.caption, minWidth: 28 }}>{rule.unit}</span>}
                  </div>
                </Card>
              )
            })}
          </div>

          {invalidRules.length > 0 && <Alert id="segment-rule-error" variant="destructive"><AlertDescription>Kural değerleri 0-10.000.000 aralığında olmalı; gün, ziyaret ve puan için tam sayı girin.</AlertDescription></Alert>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </FieldGroup></fieldset>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-popover p-4">
          <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>İptal</Button>
          <Button type="button" disabled={!canSave} onClick={() => { void onSave({ name: name.trim(), definition: pruneDefinition(definition) }) }}>
            {saving && <Spinner />}{saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      <style>{`@media (max-width: 560px) { .customer-segment-rule { grid-template-columns: 1fr !important; } }`}</style>
      </DialogContent>
    </Dialog>
  )
}

export default function CustomersClient(props: Parameters<typeof CustomersClientContent>[0]) {
  return <DashboardDraftProvider message="Müşteriler bölümünde kaydedilmemiş değişiklikler var. Çıkarsan taslağın silinecek."><CustomersClientContent {...props} /></DashboardDraftProvider>
}
