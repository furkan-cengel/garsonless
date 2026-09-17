'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tables } from '@garsonless/db/types'
import { applyMenuBulkRule, bulkPrice, validateMenuBulkPatches, type MenuBulkChange, type MenuBulkItem, type MenuBulkOperation, type MenuBulkPatch, type MenuBulkRule } from '@garsonless/domain/menu-bulk'
import type { MenuBulkRequest } from '@garsonless/application/menu-bulk'
import { menuBulkAction } from '@/lib/actions/menu-bulk'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { MenuBulkRules } from './MenuBulkRules'
import { MenuBulkProductTable } from './MenuBulkProductTable'
import { MenuBulkHistory } from './MenuBulkHistory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, HistoryIcon, PencilLineIcon, XIcon } from 'lucide-react'
import { MenuBulkChanges } from './MenuBulkChanges'
import { bulkErrorMessage, draftPatches, toBulkDraft, type BulkDraft } from './menu-bulk-editor-model'
import { useMenuDraft, useMenuDrafts } from './MenuDraftProvider'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'

export default function MenuBulkEditor({ restaurantId, items, categories, historyOnly = false, scope = 'selected', onClose, onApplied }: {
  restaurantId: string; items: MenuBulkItem[]; categories: Tables<'menu_categories'>[]; historyOnly?: boolean; scope?: 'all' | 'selected'
  onClose: () => void; onApplied: (changes: MenuBulkChange[]) => void
}) {
  const [original, setOriginal] = useState(items)
  const [draft, setDraft] = useState(() => items.map(toBulkDraft))
  const [tab, setTab] = useState(historyOnly ? 'history' : 'edit')
  const [preview, setPreview] = useState<{ changes: MenuBulkChange[]; patches: MenuBulkPatch[]; requestId: string } | null>(null)
  const [history, setHistory] = useState<MenuBulkOperation[]>([])
  const [offset, setOffset] = useState(0)
  const [detail, setDetail] = useState<{ operation: MenuBulkOperation; changes: MenuBulkChange[] } | null>(null)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const undoRequests = useRef(new Map<string, string>())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflicts, setConflicts] = useState<string[]>([])
  const { requestExit } = useMenuDrafts()
  const dirty = JSON.stringify(draft) !== JSON.stringify(original.map(toBulkDraft))
  useMenuDraft(dirty, pending, () => { setDraft(original.map(toBulkDraft)); setPreview(null) })

  const run = useCallback(async (request: Omit<MenuBulkRequest, 'restaurantId'>) => {
    if (busy.current) return null
    busy.current = true; setPending(true); setError(''); setNotice(''); setConflicts([])
    try {
      const result = await menuBulkAction({ ...request, restaurantId })
      if (!result.ok) { setError(result.error === 'conflict' && request.mode === 'undo' ? 'Ürünler bu işlemden sonra değiştirildi veya silindi. Sonraki değişiklikleri korumak için işlem geri alınmadı.' : bulkErrorMessage(result.error)); setConflicts(result.conflicts ?? []); return null }
      return result
    } catch { setError(bulkErrorMessage('unavailable')); return null }
    finally { busy.current = false; setPending(false) }
  }, [restaurantId])
  const loadHistory = useCallback(async (page: number) => {
    const result = await run({ mode: 'history', offset: page })
    if (result) { setHistory(result.history ?? []); setOffset(page) }
  }, [run])
  useEffect(() => { if (tab === 'history') void loadHistory(0) }, [tab, loadHistory])
  const change = useCallback((id: string, patch: Partial<BulkDraft>) => {
    setDraft(current => current.map((row, index) => original[index]?.id === id ? { ...row, ...patch } : row)); setPreview(null)
  }, [original])
  function remove(id: string) {
    setDraft(current => current.filter((_, index) => original[index]?.id !== id)); setOriginal(current => current.filter(item => item.id !== id)); setPreview(null); setConflicts(current => current.filter(value => value !== id))
  }
  function applyRule(rule: MenuBulkRule) {
    try {
      const next = draft.map(row => toBulkDraft(applyMenuBulkRule({ ...row, price: bulkPrice(row.price) }, rule)))
      const patches = draftPatches(original, next)
      const invalid = patches.length ? validateMenuBulkPatches(patches) : null
      if (invalid) throw new Error(invalid)
      setDraft(next); setPreview(null); setError(''); setNotice('Kural taslağa uygulandı. Değişiklikleri inceleyip yayımlayabilirsiniz.'); return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kural uygulanamadı.'); return false }
  }
  async function review() {
    try {
      const patches = draftPatches(original, draft)
      if (!patches.length) { setNotice('Kaydedilecek değişiklik yok.'); return }
      const invalid = validateMenuBulkPatches(patches)
      if (invalid) throw new Error(invalid)
      const result = await run({ mode: 'preview', patches })
      if (result) setPreview({ changes: result.changes, patches, requestId: crypto.randomUUID() })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Alanları kontrol edin.') }
  }
  async function apply() {
    if (!preview) return
    const result = await run({ mode: 'apply', patches: preview.patches, requestId: preview.requestId })
    if (result) { onApplied(result.changes); onClose() }
  }
  async function reload() {
    const result = await run({ mode: 'snapshot', patches: original.map(item => ({ id: item.id, expectedUpdatedAt: item.updated_at, changes: {} })) })
    if (!result?.items) return
    const fresh = new Map(result.items.map(item => [item.id, item]))
    const missing = original.filter(item => !fresh.has(item.id)).map(item => item.id)
    // Preserve only the merchant's changed fields while adopting current values elsewhere.
    const next = original.map((item, index) => {
      const row = draft[index]!
      const old = toBulkDraft(item)
      const updated = fresh.has(item.id) ? toBulkDraft(fresh.get(item.id)!) : row
      return Object.fromEntries(Object.entries(row).map(([key,value]) => [key, value !== old[key as keyof BulkDraft] ? value : updated[key as keyof BulkDraft]])) as BulkDraft
    })
    setOriginal(current => current.map(item => fresh.get(item.id) ?? item)); setDraft(next); setPreview(null); setConflicts(missing)
    setNotice(missing.length ? 'Silinmiş ürünleri seçimden çıkarın. Diğer ürünlerde taslağınız korundu.' : 'Güncel değerler yüklendi, değişiklikleriniz korundu. Eski → yeni değerleri yeniden inceleyin.')
  }
  async function undo() {
    if (!detail) return
    setConfirmUndo(false)
    const id = detail.operation.id
    if (!undoRequests.current.has(id)) undoRequests.current.set(id, crypto.randomUUID())
    const result = await run({ mode: 'undo', operationId: id, requestId: undoRequests.current.get(id)! })
    if (result) { onApplied(result.changes); setDetail(null); await loadHistory(offset); setNotice('İşlem geri alındı.') }
  }
  const changedCount = original.filter((item,index) => JSON.stringify(toBulkDraft(item)) !== JSON.stringify(draft[index])).length
  const categoryCount = new Set(original.map(item => item.category_id)).size
  return <Dialog open onOpenChange={open => { if (!open) requestExit(onClose) }}>
    <DialogContent showCloseButton={false} className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none md:h-[calc(100dvh-3rem)] md:w-[calc(100%-3rem)] md:max-w-[1500px] md:rounded-2xl">
      <DialogHeader className="border-b px-4 py-5 md:px-6"><div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><div className="hidden size-10 items-center justify-center rounded-xl bg-muted sm:flex"><PencilLineIcon className="size-5" /></div><div className="flex flex-col gap-2"><DialogTitle>Toplu düzenle</DialogTitle><DialogDescription>Ürünlerinizi birlikte düzenleyin, değişiklikleri kontrol edip yayımlayın.</DialogDescription></div></div>
        <Button variant="ghost" size="icon-sm" aria-label="Kapat" disabled={pending} onClick={() => requestExit(onClose)}><XIcon /></Button>
      </div></DialogHeader>
      <Tabs className="flex min-h-0 flex-1 flex-col gap-0" value={tab} onValueChange={value => { if (value === 'history') requestExit(() => { setTab(value); setPreview(null) }); else setTab(value) }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6"><TabsList variant="line"><TabsTrigger value="edit" disabled={historyOnly || pending}><PencilLineIcon />Düzenle</TabsTrigger><TabsTrigger value="history" disabled={pending}><HistoryIcon />İşlem geçmişi</TabsTrigger></TabsList>
          {!historyOnly && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{scope === 'all' ? 'Tüm menü' : 'Seçili ürünler'}</Badge><span>{original.length} ürün · {categoryCount} kategori</span></div>}
        </div>
        <TabsContent value={tab} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3 md:p-5">
          <div className="flex flex-col gap-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}{conflicts.length > 0 && <span>{conflicts.map(id => original.find(item => item.id === id)?.name ?? detail?.changes.find(change => change.id === id)?.name ?? id).join(', ')}</span>}</AlertDescription></Alert>}
            {notice && <Alert><CheckIcon /><AlertDescription>{notice}</AlertDescription></Alert>}
            <fieldset disabled={pending} className="min-w-0">
              {tab === 'edit' ? preview ? <Card><CardHeader><CardTitle>Değişiklikleri incele</CardTitle><CardDescription>{preview.changes.length} ürün onayınızdan sonra menüde güncellenecek. İşlem geçmişinden geri alabilirsiniz.</CardDescription></CardHeader><CardContent><MenuBulkChanges changes={preview.changes} categories={categories} /></CardContent></Card> :
                <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                  <MenuBulkRules categories={categories} count={original.length} onApply={applyRule} />
                  <MenuBulkProductTable original={original} draft={draft} categories={categories} conflicts={conflicts} onChange={change} onRemove={remove} />
                </div>
                : <MenuBulkHistory history={history} detail={detail} categories={categories} pending={pending} error={error} offset={offset} onPage={page => void loadHistory(page)} onBack={() => setDetail(null)} onUndo={() => setConfirmUndo(true)} onDetail={async operation => { const result = await run({ mode: 'detail', operationId: operation.id }); if (result) setDetail({ operation, changes: result.changes }) }} />}
            </fieldset>
          </div>
        </TabsContent>
        {tab === 'edit' && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background p-4 md:px-6">
          <div className="flex flex-col gap-1"><span className="text-sm font-medium">{changedCount ? `${changedCount} ürün değişecek` : 'Henüz değişiklik yok'}</span><span className="hidden text-xs text-muted-foreground sm:block">Onayınızdan sonra menüye yansır.</span></div>
          <div className="flex flex-wrap items-center gap-2">
            {conflicts.length > 0 && <Button variant="outline" disabled={pending} onClick={() => void reload()}>Güncel değerleri yükle</Button>}
            {preview ? <><Button variant="outline" disabled={pending} onClick={() => setPreview(null)}><ArrowLeftIcon data-icon="inline-start" />Düzenlemeye dön</Button><Button disabled={pending || !preview.changes.length} onClick={() => void apply()}>{pending ? 'Kaydediliyor…' : `${preview.changes.length} ürünü güncelle`}<CheckIcon data-icon="inline-end" /></Button></>
              : <Button disabled={pending || !dirty || !original.length} onClick={() => void review()}>{pending ? 'Kontrol ediliyor…' : 'Değişiklikleri incele'}<ArrowRightIcon data-icon="inline-end" /></Button>}
          </div>
        </div>}
      </Tabs>
      {confirmUndo && <UnsavedChangesDialog title="İşlem geri alınsın mı?" description="Ürünler bu işlemden sonra değiştirilmemişse önceki değerleri hemen yayımlanacak." discardLabel="İşlemi geri al" keepLabel="Vazgeç" onKeepEditing={() => setConfirmUndo(false)} onDiscard={() => void undo()} />}
    </DialogContent>
  </Dialog>
}
