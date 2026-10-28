'use client'

import type { PanoStaffSource } from '@garsonless/application/read-models'
import { PanoCard } from './PanoOverviewWidgets'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toLocaleUpperCase('tr-TR')).join('') || '?'

/** Who has worked today: orders entered, bills collected and the hours between first and last. */
export function PanoShiftStaff({ staff, timezone, footer }: { staff: PanoStaffSource; timezone: string; footer?: React.ReactNode }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
  return (
    <PanoCard title="Bugünkü vardiya" subtitle="Panelden sipariş girenler ve tahsilat alanlar">
      <div className="flex flex-col gap-2 p-4">
        {staff.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">Bugün panelden sipariş giren ya da tahsilat alan olmadı. QR menüden gelen siparişler burada sayılmaz.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {staff.map((person) => (
              <li key={person.userId} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-muted text-[10.5px] font-bold">{initials(person.name)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate"><strong className="font-semibold">{person.name}</strong>{person.isOwner ? ' (sahip)' : ''}</span>
                  <span className="pano-number text-xs text-muted-foreground">{time(person.firstAt)}–{time(person.lastAt)}</span>
                </span>
                <span className="pano-number whitespace-nowrap text-xs text-muted-foreground">
                  {person.entered} sipariş{person.settled ? ` · ${person.settled} tahsilat` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {footer}
      </div>
    </PanoCard>
  )
}
