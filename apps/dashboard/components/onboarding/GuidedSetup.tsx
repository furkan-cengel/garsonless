'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRightIcon, CheckIcon, FileUpIcon, XIcon } from 'lucide-react'
import type { OnboardingSnapshot } from '@garsonless/application/onboarding'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Card, CardAction, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { useShell } from '@/lib/shell-context'
import type { DashboardSectionEntitlements } from '@/lib/auth/dashboard-entitlements'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { availableSetupTours, parseGuideProgress, type GuideProgress, type SetupTour } from './guided-setup-model'
import { OPEN_MENU_IMPORT_EVENT, OPEN_SETUP_EVENT, useMenuImports } from './menu-import-client'
import { MenuImportDialog, IMPORT_STATUS } from './MenuImportDialog'
import { publishGuidedSetupStatus } from './guided-setup-status'

interface Props { restaurantId: string; userKey: string; permissions: string[]; isOwner: boolean; entitlements: DashboardSectionEntitlements; onboarding: OnboardingSnapshot | null }
export default function GuidedSetup({ restaurantId, userKey, permissions, isOwner, entitlements, onboarding }: Props) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [active, setActive] = useState<GuideProgress | null>(null)
  const [resume, setResume] = useState<GuideProgress | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [pending, setPending] = useState<{ description: string; run: () => void } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const shell = useShell()
  const canMenu = (isOwner || permissions.includes('menu')) && entitlements.menu.allowed
  const controller = useMenuImports(restaurantId, canMenu)
  const tours = availableSetupTours(permissions, entitlements, isOwner)
  const storageKey = `masabu:guided-setup:v1:${restaurantId}:${userKey}`
  const job = controller.snapshot?.jobs[0]
  // Finished imports keep their card until it is closed once; the choice is remembered per browser.
  const dismissKey = `${storageKey}:import-dismissed`
  const [dismissedJobId, setDismissedJobId] = useState<string | null>(null)
  useEffect(() => { try { setDismissedJobId(localStorage.getItem(dismissKey)) } catch { /* Optional. */ } }, [dismissKey])
  const dismissJob = (id: string) => { setDismissedJobId(id); try { localStorage.setItem(dismissKey, id) } catch { /* Optional. */ } }
  const jobFinished = job?.status === 'applied' || job?.status === 'failed'
  const showJobCard = Boolean(job) && !importOpen && job?.status !== 'cancelled' && !(jobFinished && job?.id === dismissedJobId)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      setResume(parseGuideProgress(stored.progress))
      setSeen(Array.isArray(stored.seen) ? stored.seen.filter((value: unknown) => typeof value === 'string' && ['menu', 'logo', 'theme'].includes(value)) : [])
    } catch { /* Storage is optional; the panel remains usable. */ }
    const openSetup = () => setSetupOpen(true)
    const openImport = () => { if (canMenu) setImportOpen(true) }
    window.addEventListener(OPEN_SETUP_EVENT, openSetup)
    window.addEventListener(OPEN_MENU_IMPORT_EVENT, openImport)
    return () => { window.removeEventListener(OPEN_SETUP_EVENT, openSetup); window.removeEventListener(OPEN_MENU_IMPORT_EVENT, openImport) }
  }, [storageKey, canMenu])
  function persist(progress: GuideProgress | null, completed = seen) {
    setResume(progress)
    try { localStorage.setItem(storageKey, JSON.stringify({ progress, seen: completed })) } catch { /* Optional local tour memory. */ }
  }
  function start(tour: SetupTour, step = 0) {
    const run = () => {
      const next = { tour: tour.id, step }
      setSetupOpen(false); setActive(next); persist(next)
      const href = `/dashboard/${restaurantId}/${tour.route}`
      shell.beginNavigation(href); router.push(href)
    }
    if (shell.interceptNavigation?.(run)) return
    const guard = shell.getNavigationGuard()
    if (guard) setPending({ description: guard, run })
    else run()
  }
  const tour = tours.find(tour => tour.id === active?.tour)
  function next(fromControl = false) {
    if (!tour || !active) return
    if (active.step + 1 >= tour.steps.length) {
      const completed = [...new Set([...seen, tour.id])]
      setSeen(completed); setActive(null); persist(null, completed); setSetupOpen(!fromControl)
      void controller.refresh()
    } else { const progress = { ...active, step: active.step + 1 }; setActive(progress); persist(progress) }
  }
  // Focus returns to the guide's fixed entry in the rail (or the page when the rail hides it).
  function pause() { setActive(null); document.querySelector<HTMLElement>('[data-guided-setup-entry]')?.focus() }
  const itemCount = controller.snapshot?.itemCount ?? onboarding?.itemCount ?? 0
  const hasLogo = controller.snapshot?.hasLogo ?? !!onboarding?.logoUrl
  const setupTasks = [{ id: 'menu', done: itemCount > 0 }, { id: 'logo', done: hasLogo }].filter(task => tours.some(tour => tour.id === task.id))
  const completed = setupTasks.filter(task => task.done).length
  // The rail shows the guide only while setup is unfinished or a tour can be resumed; Help always links to it.
  const railVisible = tours.length > 0 && (completed < setupTasks.length || Boolean(resume && tours.some(item => item.id === resume.tour)))
  useEffect(() => {
    publishGuidedSetupStatus({ visible: railVisible, completed, total: setupTasks.length })
  }, [railVisible, completed, setupTasks.length])
  useEffect(() => () => publishGuidedSetupStatus({ visible: false, completed: 0, total: 0 }), [])
  const showTour = active && tour && !importOpen && !setupOpen && !shell.overlay && pathname === `/dashboard/${restaurantId}/${tour.route.split('?')[0]}`
  return <>
    <div className="fixed z-40 right-3 bottom-[calc(80px+env(safe-area-inset-bottom))] flex max-w-[calc(100vw-24px)] flex-col items-end gap-2 md:bottom-4" data-guided-setup-launcher>
      {job && showJobCard && <Card className="w-72 gap-2 py-3 shadow-lg">
        <CardHeader className="gap-1"><CardTitle role="status">{IMPORT_STATUS[job.status]}</CardTitle><CardDescription className="truncate">{job.filename}</CardDescription>
          {jobFinished && <CardAction><Button variant="ghost" size="icon-sm" aria-label="Aktarım bildirimini kapat" onClick={() => dismissJob(job.id)}><XIcon /></Button></CardAction>}
        </CardHeader>
        <CardContent>{job.status === 'queued' || job.status === 'reading' ? <Progress value={null} aria-label={IMPORT_STATUS[job.status]} /> : <p className="text-sm text-muted-foreground">{job.status === 'review' ? `${job.rows.length} ürün kontrolünü bekliyor` : job.status === 'applied' ? `${job.imported_count} ürün eklendi` : 'Ayrıntıları açarak yeniden deneyebilirsin'}</p>}</CardContent>
        <CardFooter>{job.status === 'applied'
          ? <Button className="w-full" variant="outline" onClick={() => { dismissJob(job.id); router.push(`/dashboard/${restaurantId}/menu`) }}>Ürünlere git<ArrowRightIcon data-icon="inline-end" /></Button>
          : <Button className="w-full" variant="outline" onClick={() => setImportOpen(true)}>{job.status === 'failed' ? 'Ayrıntıları aç' : 'Aktarımı aç'}<ArrowRightIcon data-icon="inline-end" /></Button>}</CardFooter>
      </Card>}
    </div>
    <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-xl"><DialogHeader className="shrink-0 pr-8"><DialogTitle>Menünü birlikte hazırlayalım</DialogTitle><DialogDescription>Kısa turlarla paneli tanı. İstediğin zaman ara verebilir, buradan devam edebilirsin.</DialogDescription></DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-1">
          {setupTasks.length > 0 && <><div className="flex justify-between text-sm"><span>Menü ve logo kurulumu</span><span>{completed}/{setupTasks.length} tamamlandı</span></div><Progress value={completed / setupTasks.length * 100} aria-label="Kurulum ilerlemesi" /></>}
          {resume && tours.some(tour => tour.id === resume.tour) && <Button variant="secondary" onClick={() => start(tours.find(tour => tour.id === resume.tour)!, resume.step)}>Kaldığım adımdan devam et<ArrowRightIcon data-icon="inline-end" /></Button>}
          {tours.map(tour => {
            const done = setupTasks.find(task => task.id === tour.id)?.done
            return <Card key={tour.id} className="shrink-0"><CardHeader><CardTitle className="flex items-center justify-between gap-3">{tour.title}{done && <Badge variant="secondary"><CheckIcon />Hazır</Badge>}</CardTitle><CardDescription>{tour.description}</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{tour.steps.length} kısa adım{seen.includes(tour.id) ? ' · Tur incelendi' : ''}</p></CardContent>
              <CardFooter><Button variant="outline" onClick={() => start(tour)}>{seen.includes(tour.id) ? 'Turu yeniden aç' : 'Bana göster'}<ArrowRightIcon data-icon="inline-end" /></Button>
                {tour.id === 'menu' && <Button variant="ghost" onClick={() => { setSetupOpen(false); setImportOpen(true) }}><FileUpIcon data-icon="inline-start" />Dosya yükle</Button>}
              </CardFooter></Card>
          })}
          <p className="text-xs text-muted-foreground">Tur ilerlemen bu tarayıcıda saklanır. Kurulum tamamlanması menündeki gerçek ürün ve logo bilgilerine göre hesaplanır.</p>
        </div><DialogFooter className="shrink-0"><Button variant="outline" onClick={() => setSetupOpen(false)}>Şimdi değil</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {showTour && <TourStep key={`${tour.id}:${active.step}:${pathname}`} step={tour.steps[active.step]!} number={active.step + 1} total={tour.steps.length} onNext={() => next()} onActivate={() => next(true)} onPause={pause} onBack={active.step > 0 ? () => { const value = { ...active, step: active.step - 1 }; setActive(value); persist(value) } : undefined} />}
    <MenuImportDialog open={importOpen} onClose={() => { setImportOpen(false); if (job && jobFinished) dismissJob(job.id) }} controller={controller} />
    {pending && <UnsavedChangesDialog description={pending.description} onKeepEditing={() => setPending(null)} onDiscard={() => { const run = pending.run; setPending(null); shell.setNavigationGuard(null); run() }} />}
  </>
}

function TourStep({ step, number, total, onNext, onActivate, onPause, onBack }: { step: SetupTour['steps'][number]; number: number; total: number; onNext: () => void; onActivate: () => void; onPause: () => void; onBack?: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [missing, setMissing] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const nextRef = useRef(onActivate)
  nextRef.current = onActivate
  const focusRef = useRef<HTMLButtonElement>(null)
  const advance = useCallback((event: Event) => { if ((event.currentTarget as HTMLElement)?.dataset.guide !== 'menu-actions') nextRef.current() }, [])
  useEffect(() => {
    let current: HTMLElement | null = null
    const hasModal = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [data-slot="dialog-content"][data-open], [data-slot="sheet-content"][data-open], [data-slot="alert-dialog-content"][data-open]')]
      .some(node => !node.hasAttribute('data-guide-fallback') && node.getBoundingClientRect().width > 0)
    const find = () => {
      const modal = hasModal()
      setBlocked(modal)
      const target = modal ? null : step.selector.split(',').flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector.trim())]).find(node => node.getBoundingClientRect().width > 0) ?? null
      if (target === current) return
      if (current) { current.removeAttribute('data-guide-active'); current.removeEventListener('click', advance) }
      current = target
      if (target) { target.setAttribute('data-guide-active', ''); target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); target.addEventListener('click', advance, { once: true }); setMissing(false) }
      setAnchor(target)
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-modal', 'data-open', 'data-closed'] })
    window.addEventListener('resize', find)
    const timer = setTimeout(() => { if (!current && !hasModal()) setMissing(true) }, 5000)
    return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener('resize', find); current?.removeAttribute('data-guide-active'); current?.removeEventListener('click', advance) }
  }, [step.selector, advance])
  const content = <><p className="text-xs text-muted-foreground">Adım {number}/{total}</p><h3 id="setup-tour-title" className="text-sm font-medium">{step.title}</h3><p id="setup-tour-description" className="text-sm text-muted-foreground">{step.description}</p><div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" size="sm" onClick={onPause}>Tura ara ver</Button><div className="flex gap-2">{onBack && <Button variant="outline" size="sm" onClick={onBack}>Geri</Button>}<Button ref={focusRef} size="sm" onClick={onNext}>{number === total ? 'Turu bitir' : 'İleri'}</Button></div></div></>
  return <>
    <style>{'[data-guide-active] { outline: 3px solid var(--primary); outline-offset: 5px; }'}</style>
    {anchor && <Popover open modal={false} onOpenChange={(open, details) => { if (!open && details.reason === 'escape-key') onPause() }}><PopoverContent anchor={anchor} initialFocus={focusRef} aria-labelledby="setup-tour-title" aria-describedby="setup-tour-description" className="flex w-80 flex-col gap-3">{content}</PopoverContent></Popover>}
    {missing && !blocked && <Dialog open onOpenChange={open => { if (!open) onPause() }}><DialogContent data-guide-fallback><DialogHeader><DialogTitle>Bu adım şu an görünmüyor</DialogTitle><DialogDescription>Ekranı açıp turu yeniden başlatabilir veya sonraki adıma geçebilirsin.</DialogDescription></DialogHeader>{content}</DialogContent></Dialog>}
  </>
}
