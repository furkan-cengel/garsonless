'use client'

import Link from 'next/link'
import type { PanoBusinessSource } from '@garsonless/application/read-models'
import { formatPanoCurrency } from '../../lib/pano-format'
import { I } from '../../lib/ui'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PanoCard } from './PanoOverviewWidgets'
import type { PanoTask, PanoTaskTone } from './pano-shift-model'

const TONE: Record<PanoTaskTone, { icon: keyof typeof I; card: string; iconBox: string; primary: boolean }> = {
  late: { icon: 'warn', card: 'border-destructive/30 bg-destructive/5', iconBox: 'bg-destructive text-white', primary: true },
  serve: { icon: 'bell', card: 'bg-card', iconBox: 'bg-[var(--positive-bg)] text-[var(--positive)]', primary: true },
  call: { icon: 'bell', card: 'bg-card', iconBox: 'bg-[var(--warning-bg)] text-[var(--warning)]', primary: false },
  approve: { icon: 'receipt', card: 'bg-card', iconBox: 'bg-muted text-foreground', primary: true },
  stale: { icon: 'clock', card: 'border-[var(--warning)]/40 bg-[var(--warning-bg)]/40', iconBox: 'bg-[var(--warning-bg)] text-[var(--warning)]', primary: false },
}

/**
 * The shift and service views: what to do now, then the kitchen and the room.
 * The shift view adds the till; the service view never shows money.
 */
export function PanoShiftView({
  tasks,
  busyTaskId,
  message,
  onDismissMessage,
  onRun,
  kitchen,
  tableStates,
  till,
  links,
}: {
  tasks: PanoTask[]
  busyTaskId: string | null
  message: { text: string; error: boolean } | null
  onDismissMessage: () => void
  onRun: (task: PanoTask) => void
  kitchen: { pending: number; preparing: number; ready: number }
  tableStates: Array<{ status: string; label: string; count: number }>
  /** Shift view only. */
  till: { business: PanoBusinessSource | null; openAmount: number } | null
  links: { orders: string | null; tables: string | null }
}) {
  const groups = [
    { key: 'now' as const, title: 'Şimdi', className: 'text-destructive', icon: 'warn' as const },
    { key: 'soon' as const, title: 'Yakında', className: 'text-[var(--warning)]', icon: 'clock' as const },
  ].map((group) => ({ ...group, tasks: tasks.filter((task) => task.group === group.key) })).filter((group) => group.tasks.length > 0)
  const nowCount = tasks.filter((task) => task.group === 'now').length
  const today = till?.business?.today

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section aria-labelledby="pano-todo-heading" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="pano-todo-heading" className="text-base font-semibold">Yapılacaklar</h2>
          <span className="text-xs text-muted-foreground">{tasks.length ? `${nowCount} şimdi · ${tasks.length - nowCount} yakında` : 'Bekleyen yok'}</span>
        </div>
        {message && (
          <div role={message.error ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${message.error ? 'bg-destructive/10 text-destructive' : 'bg-[var(--positive-bg)] text-[var(--positive)]'}`}>
            <span className="min-w-0 flex-1">{message.text}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Bildirimi kapat" onClick={onDismissMessage}><I.close /></Button>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h3 className={`m-0 inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase ${group.className}`}>
              {(() => { const Icon = I[group.icon]; return <Icon size={13} aria-hidden="true" /> })()}
              {group.title}
            </h3>
            {group.tasks.map((task) => {
              const tone = TONE[task.tone]
              const Icon = I[tone.icon]
              return (
                <div key={task.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 ${tone.card}`}>
                  <span aria-hidden="true" className={`grid size-8 flex-none place-items-center rounded-lg ${tone.iconBox}`}><Icon size={16} /></span>
                  <div className="min-w-0 flex-[1_1_200px]">
                    <strong className="block text-sm font-semibold">{task.title}</strong>
                    {task.sub && <span className="text-xs text-muted-foreground">{task.sub}</span>}
                  </div>
                  {task.action?.kind === 'open' ? (
                    <Button size="sm" variant={tone.primary ? 'default' : 'outline'} nativeButton={false} render={<Link href={task.action.href} />}>{task.actionLabel}</Button>
                  ) : task.action ? (
                    <Button size="sm" variant={tone.primary ? 'default' : 'outline'} disabled={busyTaskId !== null} aria-busy={busyTaskId === task.id} onClick={() => onRun(task)}>
                      {busyTaskId === task.id && <Spinner data-icon="inline-start" aria-hidden="true" />}
                      {task.actionLabel}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ))}
        {tasks.length === 0 && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-[var(--positive)]/30 bg-[var(--positive-bg)]/50 p-4">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-[var(--positive-bg)] text-[var(--positive)]"><I.check size={18} /></span>
            <div>
              <strong className="block text-sm">Her şey yolunda</strong>
              <span className="text-xs text-muted-foreground">Bekleyen iş yok. Yeni bir sipariş ya da istek geldiğinde burada görünür.</span>
            </div>
          </div>
        )}
      </section>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3" aria-label="Vardiya durumu">
        {till && (
          <PanoCard title="Vardiya kasası" subtitle="Bugün">
            <dl className="m-0 grid grid-cols-2 gap-3 p-4">
              <div><dt className="text-xs text-muted-foreground">Tahsil edilen</dt><dd className="pano-number m-0 text-lg font-semibold">{today ? formatPanoCurrency(today.revenue) : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Açık tutar</dt><dd className={`pano-number m-0 text-lg font-semibold ${till.openAmount > 0 ? 'text-destructive' : ''}`}>{formatPanoCurrency(till.openAmount)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Nakit</dt><dd className="pano-number m-0 text-lg font-semibold">{today ? formatPanoCurrency(today.cash) : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">İkram · İptal</dt><dd className="pano-number m-0 text-lg font-semibold">{today ? `${formatPanoCurrency(today.comp)} · ${today.cancelledCount}` : '—'}</dd></div>
            </dl>
          </PanoCard>
        )}
        <PanoCard title="Mutfak durumu" action={links.orders ? <Button variant="link" size="sm" nativeButton={false} render={<Link href={links.orders} />}>Siparişler</Button> : undefined}>
          <div className="grid grid-cols-3 gap-2 p-3">
            {[
              { label: 'Onay bekliyor', count: kitchen.pending, className: 'bg-muted' },
              { label: 'Hazırlanıyor', count: kitchen.preparing, className: 'bg-[var(--warning-bg)]' },
              { label: 'Hazır', count: kitchen.ready, className: 'bg-[var(--positive-bg)]' },
            ].map((cell) => (
              <div key={cell.label} className={`rounded-lg p-2.5 ${cell.className}`}>
                <span className="block text-xs font-medium text-muted-foreground">{cell.label}</span>
                <strong className="pano-number text-2xl font-semibold">{cell.count}</strong>
              </div>
            ))}
          </div>
        </PanoCard>
        <PanoCard title="Masalar" action={links.tables ? <Button variant="link" size="sm" nativeButton={false} render={<Link href={links.tables} />}>Salon planı</Button> : undefined}>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-3" aria-label="Masa durumları">
            {tableStates.map((state) => (
              <li key={state.status} data-status={state.status} className="pano-table-pill inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold">
                {state.label} · {state.count}
              </li>
            ))}
          </ul>
        </PanoCard>
      </aside>
    </div>
  )
}
