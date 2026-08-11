'use client'

import { useState } from 'react'
import { analyticsCustomDayCount } from '../../lib/analytics-filter-contract'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { ANALYTICS_RANGES, type AnalyticsQuery, type AnalyticsRange } from './analytics-report-model'

const DATE_ERROR_ID = 'analytics-custom-range-error'

export default function AnalyticsRangePicker({
  query,
  onRangeChange,
  onQueryChange,
  loading,
}: {
  query: AnalyticsQuery
  onRangeChange: (range: AnalyticsRange) => void
  onQueryChange: (query: AnalyticsQuery) => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(query.from ?? '')
  const [to, setTo] = useState(query.to ?? '')
  const [dateError, setDateError] = useState<string | null>(null)
  const selectedRangeLabel = ANALYTICS_RANGES.find((range) => range.id === query.range)?.label ?? query.range

  const openCustomRange = () => {
    const today = new Date()
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const defaultFrom = new Date(today)
    defaultFrom.setDate(defaultFrom.getDate() - 6)
    setFrom(query.from ?? dateKey(defaultFrom))
    setTo(query.to ?? dateKey(today))
    setDateError(null)
    setOpen(true)
  }

  const applyCustomRange = () => {
    const days = analyticsCustomDayCount(from, to)
    if (days < 1 || days > 366) {
      setDateError('Başlangıç bitişten önce olmalı ve dönem en fazla 366 gün sürmelidir.')
      return
    }
    setOpen(false)
    onQueryChange({ ...query, range: 'custom', from, to })
  }

  return (
    <>
      <Select
        value={query.range}
        disabled={loading}
        onValueChange={(value) => {
          if (!value) return
          const nextRange = value as AnalyticsRange
          if (nextRange === 'custom') openCustomRange()
          else onRangeChange(nextRange)
        }}
      >
        <SelectTrigger className="analytics-range-select" size="sm" aria-label="Rapor dönemi">
          <SelectValue>{selectedRangeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {ANALYTICS_RANGES.map((range) => <SelectItem key={range.id} value={range.id}>{range.label}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setDateError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Özel tarih aralığı</DialogTitle>
            <DialogDescription>Başlangıç ve bitiş günleri restoran saat diliminde kapsama dahildir.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); applyCustomRange() }}>
            <FieldGroup className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={dateError ? true : undefined}>
                <FieldLabel htmlFor="analytics-range-from">Başlangıç</FieldLabel>
                <Input
                  id="analytics-range-from"
                  type="date"
                  value={from}
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                  onChange={(event) => { setFrom(event.target.value); setDateError(null) }}
                />
              </Field>
              <Field data-invalid={dateError ? true : undefined}>
                <FieldLabel htmlFor="analytics-range-to">Bitiş</FieldLabel>
                <Input
                  id="analytics-range-to"
                  type="date"
                  value={to}
                  aria-invalid={dateError ? true : undefined}
                  aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                  onChange={(event) => { setTo(event.target.value); setDateError(null) }}
                />
              </Field>
              {dateError && <FieldError id={DATE_ERROR_ID} className="sm:col-span-2">{dateError}</FieldError>}
            </FieldGroup>
            <DialogFooter className="mt-5">
              <DialogClose render={<Button type="button" variant="outline" />}>Vazgeç</DialogClose>
              <Button type="submit">Uygula</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
