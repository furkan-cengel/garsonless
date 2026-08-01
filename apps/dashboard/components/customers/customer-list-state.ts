import type { CustomerSegment, CustomerSort } from '@garsonless/domain/customers'

export const CUSTOMER_LIST_DEFAULT_SORT: CustomerSort = 'last_seen'

const SORTS = new Set<CustomerSort>(['last_seen', 'spend', 'visits', 'points', 'joined'])
const SEGMENTS = new Set<CustomerSegment>(['new', 'frequent', 'lapsed', 'consented'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface CustomerListState {
  search: string
  segment: CustomerSegment | ''
  customSegmentId: string | null
  sort: CustomerSort
  page: number
}

export function parseCustomerListState(params: Pick<URLSearchParams, 'get'>): CustomerListState {
  const search = (params.get('q') ?? '').trim().slice(0, 120)
  const rawSegment = params.get('segment') ?? ''
  const rawSaved = params.get('saved')?.trim() ?? ''
  const rawSort = params.get('sort') ?? ''
  const rawPage = Number(params.get('page'))
  const customSegmentId = UUID_PATTERN.test(rawSaved) ? rawSaved : null

  return {
    search,
    segment: customSegmentId
      ? ''
      : SEGMENTS.has(rawSegment as CustomerSegment) ? rawSegment as CustomerSegment : '',
    customSegmentId,
    sort: SORTS.has(rawSort as CustomerSort) ? rawSort as CustomerSort : CUSTOMER_LIST_DEFAULT_SORT,
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, 100_000) : 1,
  }
}

export function customerListSearchParams(state: CustomerListState): URLSearchParams {
  const params = new URLSearchParams()
  const search = state.search.trim().slice(0, 120)
  if (search) params.set('q', search)
  if (state.customSegmentId && UUID_PATTERN.test(state.customSegmentId)) params.set('saved', state.customSegmentId)
  else if (state.segment && SEGMENTS.has(state.segment)) params.set('segment', state.segment)
  if (state.sort !== CUSTOMER_LIST_DEFAULT_SORT && SORTS.has(state.sort)) params.set('sort', state.sort)
  if (Number.isSafeInteger(state.page) && state.page > 1) params.set('page', String(Math.min(state.page, 100_000)))
  return params
}

export function customerListHref(pathname: string, state: CustomerListState): string {
  const query = customerListSearchParams(state).toString()
  return query ? `${pathname}?${query}` : pathname
}

export function safeCustomerListReturnPath(restaurantId: string, value: string | null | undefined): string {
  const fallback = `/dashboard/${restaurantId}/customers`
  if (!value) return fallback
  const [pathname] = value.split('?', 1)
  if (pathname !== fallback || value.includes('#') || value.startsWith('//')) return fallback
  return value
}
