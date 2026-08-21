"use client"

import * as React from "react"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"]
const MONTH_FORMATTER = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" })
const VALUE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

type CalendarDay = {
  date: Date
  inCurrentMonth: boolean
}

function parseDateTime(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function roundedNow() {
  const date = new Date()
  date.setSeconds(0, 0)
  return date
}

export function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { date, inCurrentMonth: date.getMonth() === month.getMonth() }
  })
}

export function applyCalendarDate(current: Date, selected: Date) {
  return new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
    current.getHours(),
    current.getMinutes(),
  )
}

export function applyClockTime(current: Date, time: string) {
  const [hour = Number.NaN, minute = Number.NaN] = time.split(":").map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return current
  return new Date(current.getFullYear(), current.getMonth(), current.getDate(), hour, minute)
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function clockValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Tarih ve saat seç",
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<Date>(() => parseDateTime(value) ?? roundedNow())
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const date = parseDateTime(value) ?? roundedNow()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const committedDate = parseDateTime(value)
  const days = React.useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])

  React.useEffect(() => {
    const next = parseDateTime(value)
    if (!next) return
    setDraft(next)
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1))
  }, [value])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const next = parseDateTime(value) ?? roundedNow()
      setDraft(next)
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    }
    setOpen(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn("w-full justify-between px-2.5 text-left text-xs font-normal", !committedDate && "text-muted-foreground", className)}
          />
        }
      >
        <span className="min-w-0 truncate">
          {committedDate ? VALUE_FORMATTER.format(committedDate) : placeholder}
        </span>
        <CalendarDaysIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>

      <PopoverContent className="w-[292px] p-3" aria-label="Tarih ve saat seçici">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Önceki ay"
            onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="text-xs font-semibold capitalize">{MONTH_FORMATTER.format(visibleMonth)}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Sonraki ay"
            onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-0.5" role="grid" aria-label={MONTH_FORMATTER.format(visibleMonth)}>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="grid size-8 place-items-center text-[10px] font-medium text-muted-foreground" role="columnheader">
              {weekday}
            </div>
          ))}
          {days.map(({ date, inCurrentMonth }) => {
            const selected = sameDay(date, draft)
            const today = sameDay(date, new Date())
            return (
              <button
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                type="button"
                role="gridcell"
                aria-label={new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(date)}
                aria-selected={selected}
                data-selected={selected || undefined}
                onClick={() => setDraft((current) => applyCalendarDate(current, date))}
                className={cn(
                  "grid size-8 place-items-center rounded-lg text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
                  !inCurrentMonth && "text-muted-foreground/45",
                  today && !selected && "font-semibold text-primary",
                  selected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                )}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Clock3Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor={`${id ?? "date-time"}-clock`} className="text-[11px] font-medium">Saat</label>
          <Input
            id={`${id ?? "date-time"}-clock`}
            type="time"
            step={60}
            value={clockValue(draft)}
            onInput={(event) => {
              const nextTime = event.currentTarget.value
              setDraft((current) => applyClockTime(current, nextTime))
            }}
            className="ml-auto w-[108px] text-xs"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false) }}>
            Temizle
          </Button>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button type="button" size="sm" onClick={() => { onChange(draft.toISOString()); setOpen(false) }}>Uygula</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
