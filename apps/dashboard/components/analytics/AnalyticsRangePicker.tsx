'use client'

import { useRef, useState } from 'react'
import { analyticsCustomDayCount } from '../../lib/analytics-filter-contract'
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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [from, setFrom] = useState(query.from ?? '')
  const [to, setTo] = useState(query.to ?? '')
  const [dateError, setDateError] = useState<string | null>(null)

  const openCustomRange = () => {
    const today = new Date()
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const defaultFrom = new Date(today)
    defaultFrom.setDate(defaultFrom.getDate() - 6)
    setFrom(query.from ?? dateKey(defaultFrom))
    setTo(query.to ?? dateKey(today))
    setDateError(null)
    dialogRef.current?.showModal()
  }

  const applyCustomRange = () => {
    const days = analyticsCustomDayCount(from, to)
    if (days < 1 || days > 366) {
      setDateError('Başlangıç bitişten önce olmalı ve dönem en fazla 366 gün sürmelidir.')
      return
    }
    dialogRef.current?.close()
    onQueryChange({ ...query, range: 'custom', from, to })
  }

  return (
    <>
      <select
        className="analytics-range-select"
        aria-label="Rapor dönemi"
        value={query.range}
        disabled={loading}
        onChange={(event) => {
          const nextRange = event.target.value as AnalyticsRange
          if (nextRange === 'custom') openCustomRange()
          else onRangeChange(nextRange)
        }}
      >
        {ANALYTICS_RANGES.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
      </select>
      <dialog ref={dialogRef} className="analytics-custom-range-dialog" aria-labelledby="analytics-custom-range-title">
        <form method="dialog" onSubmit={(event) => event.preventDefault()}>
          <div id="analytics-custom-range-title" role="heading" aria-level={2}>Özel tarih aralığı</div>
          <p>Başlangıç ve bitiş günleri restoran saat diliminde kapsama dahildir.</p>
          <div className="analytics-custom-range-fields">
            <label>
              Başlangıç
              <input
                type="date"
                value={from}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setDateError(null)
                }}
              />
            </label>
            <label>
              Bitiş
              <input
                type="date"
                value={to}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? DATE_ERROR_ID : undefined}
                onChange={(event) => {
                  setTo(event.target.value)
                  setDateError(null)
                }}
              />
            </label>
          </div>
          {dateError && <div id={DATE_ERROR_ID} role="alert" className="analytics-custom-range-error">{dateError}</div>}
          <div className="analytics-custom-range-actions">
            <button type="button" onClick={() => dialogRef.current?.close()}>Vazgeç</button>
            <button type="button" onClick={applyCustomRange}>Uygula</button>
          </div>
        </form>
      </dialog>
    </>
  )
}
