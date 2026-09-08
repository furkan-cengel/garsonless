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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  CampaignSummary,
  SavedCampaignEmailTemplate
} from '@garsonless/domain/campaigns'
import {
  isCustomerLapsed,
  isCustomerNew,
  type CustomerSegment,
  type CustomerSegmentCounts,
  type CustomerSegmentDefinition,
  type CustomerSort,
  type RestaurantCustomer,
  type RestaurantCustomersPage,
  type SavedCustomerSegment,
} from '@garsonless/domain/customers'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import {
  createCustomerSegmentAction,
  deleteCustomerSegmentAction,
  listCustomers,
  loadCustomerPageSupportAction,
  updateCustomerSegmentAction,
} from '../../lib/actions/customers'
import { useShell } from '../../lib/shell-context'
import { I, S } from '../../lib/ui'
import { formatCurrency } from '../../lib/utils'
import PageTopBar from '../layout/PageTopBar'
import { DashboardDraftProvider, useDashboardDraft, useDashboardDrafts } from '../overlays/DashboardDraftProvider'
import {
  customerListHref,
  parseCustomerListState,
  type CustomerListState,
} from './customer-list-state'
import { savedFilterLimitation } from './customer-save-policy'


const SEGMENTS: { id: CustomerSegment | ''; label: string }[] = [
  { id: '', label: 'Tümü' },
  { id: 'new', label: 'Yeni müşteriler' },
  { id: 'frequent', label: 'Sık gelenler' },
  { id: 'lapsed', label: 'Uzun süredir gelmeyen' },
  { id: 'consented', label: 'İzinli' },
]
const CampaignModal = dynamic(() => import('./CustomerCampaignModal'), {
  loading: () => <Dialog open><DialogContent showCloseButton={false}><DialogTitle>E-posta kampanyası</DialogTitle><DialogDescription role="status">Kampanya hazırlanıyor…</DialogDescription><Spinner aria-hidden="true" /></DialogContent></Dialog>,
})
const SORTS: { id: CustomerSort; label: string }[] = [
  { id: 'last_seen', label: 'Son görülme' },
  { id: 'spend', label: 'En çok harcayan' },
  { id: 'visits', label: 'En çok ziyaret' },
  { id: 'points', label: 'En yüksek puan' },
  { id: 'joined', label: 'İlk aktivite' },
]
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function relTime(iso: string | null, referenceNow: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
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

function CustomersClientContent({
  restaurantId,
  restaurantName,
  initial,
  canManageCampaigns,
  emailDeliveryEnabled,
  campaignReplyToEmail,
  resendWebhookEnabled,
  initialState,
  referenceNow,
}: {
  restaurantId: string
  restaurantName: string
  initial: RestaurantCustomersPage
  canManageCampaigns: boolean
  emailDeliveryEnabled: boolean
  campaignReplyToEmail: string | null
  resendWebhookEnabled: boolean
  initialState: CustomerListState
  referenceNow: string
}) {
  const { beginNavigation } = useShell()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<RestaurantCustomersPage>(initial)
  const [segmentCounts, setSegmentCounts] = useState<CustomerSegmentCounts | null>(null)
  const [savedSegments, setSavedSegments] = useState<SavedCustomerSegment[]>([])
  const [search, setSearch] = useState(initialState.search)
  const [segment, setSegment] = useState<CustomerSegment | ''>(initialState.segment)
  const [customSegmentId, setCustomSegmentId] = useState<string | null>(initialState.customSegmentId)
  const [sort, setSort] = useState<CustomerSort>(initialState.sort)
  const [page, setPage] = useState(initial.page)
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

  useEffect(() => {
    const href = customerListHref(pathname, { search, segment, customSegmentId, sort, page })
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(window.history.state, '', href)
    }
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

  const globalTotal = segmentCounts?.total ?? null
  const saveFilterWarning = savedFilterLimitation(search, segment)
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const activeSavedSegment = customSegmentId
    ? savedSegments.find((sg) => sg.id === customSegmentId) ?? null
    : null
  const hasActiveFilters = Boolean(search.trim() || segment || customSegmentId)

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

  function openCustomer(customerId: string) {
    const returnTo = customerListHref(pathname, { search, segment, customSegmentId, sort, page })
    const href = `/dashboard/${restaurantId}/customers/${customerId}?returnTo=${encodeURIComponent(returnTo)}`
    beginNavigation(href)
    router.push(href)
  }

  return (
    <div className="customer-route-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title="Müşteriler" tag={<Badge variant="secondary">{globalTotal ?? '…'} müşteri</Badge>} />

      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-page-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
          <div className="customer-list-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.025em', margin: 0 }}>Müşteriler</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '5px 0 0' }}>Üyeler, sadakat bakiyeleri ve ziyaret geçmişi</p>
            </div>
            <div className="customer-page-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canManageCampaigns && <Button type="button" variant="outline" size="sm" onClick={() => setCampaignOpen(true)}>
                <I.mail size={14} />E-posta kampanyası
              </Button>}
              <Button type="button" size="sm" onClick={openCreateFromCurrent} disabled={Boolean(saveFilterWarning)}>
                <I.plus size={13} />Filtreyi kaydet
              </Button>
            </div>
          </div>

          {saveFilterWarning && <Alert role="status" className="mb-4"><AlertDescription>{saveFilterWarning}</AlertDescription></Alert>}

          {!canManageCampaigns && (
            <Alert className="mb-5" role="status">
              <I.lock size={16} />
              <AlertDescription>İletişim bilgileri güvenlik nedeniyle maskeli gösterilir. E-posta kampanyası ve manuel puan/bakiye düzenlemeleri yalnız işletme sahibine açıktır.</AlertDescription>
            </Alert>
          )}

          {listError && (
            <Alert variant="destructive" aria-live="polite" className="mb-4 pr-28">
              <I.warn size={16} />
              <AlertDescription>{listError}</AlertDescription>
              <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => setListRetry((value) => value + 1)}>Yeniden dene</Button></AlertAction>
            </Alert>
          )}

          {supportError && (
            <Alert aria-live="polite" className="mb-4 pr-28">
              <I.warn size={16} />
              <AlertDescription>Müşteri listesi hazır; özetler ve kampanya araçları yüklenemedi.</AlertDescription>
              <AlertAction><Button type="button" variant="outline" size="xs" onClick={() => setSupportRetry((value) => value + 1)}>Özetleri yenile</Button></AlertAction>
            </Alert>
          )}

          <div className="customer-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
            <MiniStat label="Toplam müşteri" value={globalTotal?.toLocaleString('tr-TR') ?? '-'} loading={supportLoading} icon={<I.users size={15} />} />
            <MiniStat
              label="İletişim izinli"
              value={segmentCounts?.consented.toLocaleString('tr-TR') ?? '-'}
              icon={<I.check size={15} />}
              sub={segmentCounts && globalTotal !== null ? `Tüm müşterilerin %${globalTotal ? Math.round((segmentCounts.consented / globalTotal) * 100) : 0}'i` : undefined}
              loading={supportLoading}
            />
            <MiniStat label="Sık gelen" value={segmentCounts?.frequent.toLocaleString('tr-TR') ?? '-'} icon={<I.star size={15} />} sub="En az 3 ziyaret" loading={supportLoading} />
            <MiniStat label="Geri kazanılacak" value={segmentCounts?.lapsed.toLocaleString('tr-TR') ?? '-'} icon={<I.clock size={15} />} sub="60+ gündür gelmeyen" loading={supportLoading} />
          </div>

          <div className="customer-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
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
                <SelectTrigger className="customer-sort-control w-48 bg-card" aria-label="Müşterileri sırala">
                  <SelectValue>{SORTS.find((option) => option.id === sort)?.label}</SelectValue>
                </SelectTrigger>
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
                    <Button type="button" variant="ghost" size="icon-xs" className="customer-saved-segment-icon customer-saved-segment-delete rounded-none" onClick={() => { setSegmentError(null); setSegmentToDelete(saved) }} aria-label={`${saved.name} sil`}><I.trash size={12} /></Button>
                  </span>
                )
              })}
            </div>
          )}

          {canManageCampaigns && supportLoading && (
            <div aria-hidden="true" className="mb-4 h-[60px] w-full animate-pulse rounded-xl border bg-muted/40 motion-reduce:animate-none" />
          )}

          {canManageCampaigns && !supportLoading && campaigns.some((campaign) => campaign.channel === 'email') && (
            <CampaignStrip campaigns={campaigns.filter((campaign) => campaign.channel === 'email').slice(0, 3)} onOpen={() => setCampaignOpen(true)} />
          )}

          {segmentError && <Alert variant="destructive" className="mb-3"><AlertDescription>{segmentError}</AlertDescription></Alert>}

          <Card className="customer-table relative gap-0 py-0" aria-busy={pending} style={{ opacity: pending ? 0.72 : 1 }}>
            {pending && <Badge role="status" variant="secondary" className="absolute right-3 top-3 z-10 gap-1.5"><Spinner aria-hidden="true" className="size-3" />Güncelleniyor</Badge>}
            <Table className="min-w-[900px]">
              <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">MÜŞTERİ</TableHead><TableHead>TELEFON</TableHead><TableHead>SEVİYE</TableHead><TableHead className="text-right">ZİYARET</TableHead><TableHead className="text-right">HARCAMA</TableHead><TableHead className="text-right">PUAN</TableHead><TableHead className="pr-5 text-right">SON GÖRÜLME</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.customers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0">
                    <Empty className="min-h-56">
                      <EmptyHeader><EmptyMedia variant="icon"><I.users size={18} /></EmptyMedia><EmptyTitle>{hasActiveFilters ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}</EmptyTitle><EmptyDescription>{hasActiveFilters ? 'Arama veya segment ölçütlerini değiştirin.' : 'Müşterileriniz QR menüden hesap oluşturduğunda burada görünür.'}</EmptyDescription></EmptyHeader>
                      {hasActiveFilters && <EmptyContent><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Filtreleri temizle</Button></EmptyContent>}
                    </Empty>
                  </TableCell></TableRow>
                ) : data.customers.map((c, i) => (
                <CustomerRow
                  key={c.customerId}
                  c={c}
                  delay={i * 25}
                  referenceNow={referenceNow}
                  onClick={() => openCustomer(c.customerId)}
                />
              ))}
              </TableBody>
            </Table>
          </Card>

          <div className="customer-mobile-list" role="list" aria-busy={pending} style={{ display: 'none' }}>
            {pending && <div role="status" className="customer-mobile-update"><Spinner aria-hidden="true" className="size-3" />Güncelleniyor</div>}
            {data.customers.length === 0 ? (
              <Card role="listitem"><Empty className="min-h-56"><EmptyHeader><EmptyMedia variant="icon"><I.users size={18} /></EmptyMedia><EmptyTitle>{hasActiveFilters ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}</EmptyTitle><EmptyDescription>{hasActiveFilters ? 'Arama veya segment ölçütlerini değiştirin.' : 'Müşterileriniz QR menüden hesap oluşturduğunda burada görünür.'}</EmptyDescription></EmptyHeader>{hasActiveFilters && <EmptyContent><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Filtreleri temizle</Button></EmptyContent>}</Empty></Card>
            ) : data.customers.map((customer) => (
              <CustomerMobileCard key={customer.customerId} customer={customer} referenceNow={referenceNow} onOpen={() => openCustomer(customer.customerId)} />
            ))}
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
          .customer-table { display: none !important; }
          .customer-mobile-list { display: grid !important; gap: 10px; position: relative; }
          .customer-mobile-update { position: sticky; top: 68px; z-index: 5; justify-self: end; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-2); font-size: 12px; box-shadow: var(--shadow-1); }
        }
        @media (max-width: 520px) {
          .customer-page-content { padding: 20px 12px 44px !important; }
          .customer-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; gap: 8px !important; }
          .customer-stats > * { min-height: 118px !important; }
          .customer-page-actions > button { padding-left: 10px !important; padding-right: 10px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .customer-control,
          .customer-campaign-strip,
          .customer-row-action { transition: none !important; transform: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function CustomerMobileCard({ customer, referenceNow, onOpen }: { customer: RestaurantCustomer; referenceNow: string; onOpen: () => void }) {
  const tags = tagsForCustomer(customer, referenceNow)
  const soft = softForTier(customer.tier.color)
  const contact = customer.email !== '-' ? customer.email : customer.phone
  return (
    <div role="listitem">
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        aria-label={`${customer.name || 'İsimsiz'} müşteri detayını aç`}
        className="customer-mobile-card h-auto min-h-32 w-full items-stretch justify-start rounded-xl p-4 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Avatar size="lg"><AvatarFallback style={{ background: soft, color: customer.tier.color }}>{initials(customer.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{customer.name || 'İsimsiz'}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{tags.join(' · ')}</span>
            </span>
            <Badge variant="secondary" style={{ color: customer.tier.color, background: soft }}><span className="size-1.5 rounded-full" style={{ background: customer.tier.color }} />{customer.tier.name}</Badge>
          </span>
          <span className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t pt-3">
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs text-muted-foreground">{contact}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{relTime(customer.lastSeen, referenceNow)} · {customer.visits} ziyaret</span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">{formatCurrency(customer.spend)}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">{customer.points} puan <I.chevRight size={11} /></span>
            </span>
          </span>
        </span>
      </Button>
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

function MiniStat({ label, value, icon, sub, mono, loading = false }: { label: string; value: string; icon: ReactNode; sub?: string; mono?: boolean; loading?: boolean }) {
  return (
    <Card size="sm" aria-busy={loading || undefined}>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <CardAction className="text-muted-foreground">{icon}</CardAction>
      </CardHeader>
      <CardContent>
        {loading
          ? <div aria-hidden="true" className="h-7 w-12 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          : <div className="text-2xl font-semibold tracking-tight tabular-nums" style={mono ? S.mono : undefined}>{value}</div>}
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
          {tags.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
        </div>
        </div>
      </TableCell>
      <TableCell><span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...S.mono }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone}</span>
        <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
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

  const { requestExit } = useDashboardDrafts()
  const dirty = name !== state.name || JSON.stringify(definition) !== JSON.stringify(state.definition)
  useDashboardDraft(dirty, saving, () => { setName(state.name); setDefinition(state.definition) })
  const requestClose = () => requestExit(onClose)
  const invalidRules = RULES.filter((rule) => {
    const value = definition[rule.key]?.value
    return value !== undefined && (!Number.isFinite(value) || value < 0 || value > 10_000_000 || (rule.integer && !Number.isInteger(value)))
  })
  const canSave = name.trim().length > 0 && !saving && invalidRules.length === 0

  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogContent showCloseButton={!saving} className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[620px]">
        <DialogHeader className="sticky top-0 z-10 border-b bg-popover px-5 py-4 pr-12">
          <DialogTitle id="customer-segment-editor-title">{state.mode === 'edit' ? 'Segmenti düzenle' : 'Segment kaydet'}</DialogTitle>
          <DialogDescription id="customer-segment-editor-description">{describeDefinition(pruneDefinition(definition))}</DialogDescription>
        </DialogHeader>

        <fieldset disabled={saving} className="min-w-0"><FieldGroup className="p-4">
          <Field><FieldLabel htmlFor="customer-segment-name">Segment adı</FieldLabel><Input id="customer-segment-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Örn. VIP geri kazanım" /></Field>

          <Field><FieldLabel htmlFor="customer-segment-consent">İletişim izni</FieldLabel>
            <Select disabled={saving} value={definition.consent ?? 'any'} onValueChange={(selected) => setDefinition((prev) => {
              const next = { ...prev }
              if (selected === 'granted' || selected === 'missing') next.consent = selected
              else delete next.consent
              return next
            })}>
              <SelectTrigger id="customer-segment-consent" className="w-full"><SelectValue>{definition.consent === 'granted' ? 'Rıza var' : definition.consent === 'missing' ? 'Rıza yok' : 'Fark etmez'}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="any">Fark etmez</SelectItem><SelectItem value="granted">Rıza var</SelectItem><SelectItem value="missing">Rıza yok</SelectItem></SelectContent>
            </Select>
          </Field>

          <div style={{ display: 'grid', gap: 8 }}>
            {RULES.map((rule) => {
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
