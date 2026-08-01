// Restaurant-local-day — THE single source of truth for "today" / day boundaries
// / day-and-hour bucketing across the reporting layer. Pure + client-safe (no DB,
// no supabase import), TZ-parameterized. Native Intl only (no library added).
//
// This is the time-analog of isCollectedOrderRow: every date query gets its
// boundaries here instead of hand-rolling `new Date(); setHours(0,0,0,0)`
// (server-local, drift-prone) or the UTC/local MIX that broke getSalesOverTime.
//
// All returned Dates are UTC INSTANTS (for `.gte('created_at', d.toISOString())`
// against timestamptz columns). All bucketing keys/hours/weekdays are computed in
// the restaurant's IANA timezone, DST-correct.

export const DEFAULT_TIMEZONE = 'Europe/Istanbul'

const RANGE_DAYS: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365 }

/** Wall-clock parts of `instant` AS SEEN in `tz` (DST-correct via Intl). */
function tzParts(instant: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = dtf.formatToParts(instant)
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value)
  let hour = get('hour')
  if (hour === 24) hour = 0 // V8 quirk: midnight can format as '24' with hour12:false
  return { year: get('year'), month: get('month'), day: get('day'), hour, minute: get('minute'), second: get('second') }
}

/**
 * The UTC instant of a given wall-clock time IN `tz`. One-pass offset resolution:
 * treat the local parts as UTC (the "guess"), see what wall-clock that guess shows
 * in tz, and correct by the difference (= the tz offset AT that instant, so DST is
 * handled). We only ever ask for midnight (00:00), which is unambiguous in every
 * zone (DST flips at 02:00/03:00), so a single pass is exact.
 */
function zonedTimeToUtc(tz: string, y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s)
  const p = tzParts(new Date(guess), tz)
  const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offset = seen - guess // tz offset (ms) at the guessed instant
  return new Date(guess - offset)
}

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const check = new Date(Date.UTC(year!, month! - 1, day!))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month! - 1 || check.getUTCDate() !== day) return null
  return { year: year!, month: month!, day: day! }
}

/** Restaurant-local midnight for a validated YYYY-MM-DD calendar key. */
export function startOfRestaurantDate(tz: string, dateKey: string): Date {
  const parsed = parseDateKey(dateKey)
  if (!parsed) throw new Error('Invalid restaurant date')
  return zonedTimeToUtc(tz, parsed.year, parsed.month, parsed.day)
}

/** Inclusive restaurant-local calendar-day count. */
export function restaurantCalendarDayCount(from: string, to: string): number {
  const start = parseDateKey(from)
  const end = parseDateKey(to)
  if (!start || !end) return 0
  return Math.floor((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000) + 1
}

/**
 * Start (local midnight, as a UTC instant) of the restaurant-local day that is
 * `n` calendar days before the day containing `from`. Day arithmetic is done on a
 * floating UTC Y/M/D holder (immune to DST) and THEN resolved to a real instant,
 * so it steps by CALENDAR days — never by ±24h (a DST day is 23h or 25h long).
 */
export function startOfDayNDaysAgo(tz: string, n: number, from: Date = new Date()): Date {
  const p = tzParts(from, tz)
  const floating = new Date(Date.UTC(p.year, p.month - 1, p.day))
  floating.setUTCDate(floating.getUTCDate() - n)
  return zonedTimeToUtc(tz, floating.getUTCFullYear(), floating.getUTCMonth() + 1, floating.getUTCDate())
}

/** Local midnight (UTC instant) of the restaurant day containing `at`. */
export function startOfRestaurantDay(tz: string, at: Date = new Date()): Date {
  return startOfDayNDaysAgo(tz, 0, at)
}

/**
 * TZ-aware replacement for getRangeWindow. Returns UTC-instant boundaries for the
 * current + previous window (previous = the equally-long window immediately before).
 * 'day' compares today vs yesterday; week/month/quarter/year span N calendar days
 * ending today (inclusive).
 */
export function rangeWindow(
  tz: string,
  range: string,
  now: Date = new Date(),
): { currentStart: Date; previousStart: Date; currentEnd: Date } {
  if (range === 'day') {
    return {
      currentStart: startOfDayNDaysAgo(tz, 0, now),
      previousStart: startOfDayNDaysAgo(tz, 1, now),
      currentEnd: now,
    }
  }
  if (range === 'yesterday') {
    return {
      currentStart: startOfDayNDaysAgo(tz, 1, now),
      previousStart: startOfDayNDaysAgo(tz, 2, now),
      currentEnd: startOfDayNDaysAgo(tz, 0, now),
    }
  }
  if (range === 'calendar_month') {
    const nowParts = tzParts(now, tz)
    const currentStart = zonedTimeToUtc(tz, nowParts.year, nowParts.month, 1)
    const elapsedDays = restaurantCalendarDayCount(
      restaurantDayKey(currentStart, tz),
      restaurantDayKey(now, tz),
    )
    return {
      currentStart,
      previousStart: startOfDayNDaysAgo(tz, elapsedDays, currentStart),
      currentEnd: now,
    }
  }
  const days = RANGE_DAYS[range] ?? 7
  return {
    currentStart: startOfDayNDaysAgo(tz, days - 1, now),
    previousStart: startOfDayNDaysAgo(tz, 2 * days - 1, now),
    currentEnd: now,
  }
}

/**
 * Inclusive custom restaurant-local date window. `to` includes the complete
 * local day unless it is today, in which case the window ends at `now`.
 * The previous comparison window has the same number of calendar days.
 */
export function customRangeWindow(
  tz: string,
  from: string,
  to: string,
  now: Date = new Date(),
): { currentStart: Date; previousStart: Date; currentEnd: Date } {
  const days = restaurantCalendarDayCount(from, to)
  if (days < 1 || days > 366) throw new Error('Invalid custom analytics range')
  const currentStart = startOfRestaurantDate(tz, from)
  if (currentStart > now) throw new Error('Future analytics range is not allowed')
  const toStart = startOfRestaurantDate(tz, to)
  const endAfterTo = startOfDayNDaysAgo(tz, -1, toStart)
  return {
    currentStart,
    previousStart: startOfDayNDaysAgo(tz, days, currentStart),
    currentEnd: endAfterTo < now ? endAfterTo : now,
  }
}

/** Local calendar-day key (YYYY-MM-DD) in `tz` — the correct daily-bucket key. */
export function restaurantDayKey(ts: Date | string, tz: string): string {
  const p = tzParts(typeof ts === 'string' ? new Date(ts) : ts, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Local hour [0..23] in `tz`. */
export function restaurantHour(ts: Date | string, tz: string): number {
  return tzParts(typeof ts === 'string' ? new Date(ts) : ts, tz).hour
}

/** Local weekday, 0=Mon … 6=Sun (the app's heatmap convention), in `tz`. */
export function restaurantWeekday(ts: Date | string, tz: string): number {
  const p = tzParts(typeof ts === 'string' ? new Date(ts) : ts, tz)
  const jsDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1
}

/** True if `tz` is a resolvable IANA zone. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Reader guard — any null/garbage value falls back to Europe/Istanbul. */
export function normalizeTimeZone(tz: unknown): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE
}
