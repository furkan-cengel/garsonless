// Supabase v2 resolves .insert()/.update()/.upsert() as never[] when consumed from
// server actions due to TypeScript generic inference limits + exactOptionalPropertyTypes.
// This helper bypasses the issue with a type-safe cast — same pattern as packages/db/src/orders.ts.

import type { createDashboardServerClient } from './supabase-server'

type SB = Awaited<ReturnType<typeof createDashboardServerClient>>
type Row = Record<string, unknown>
type DbError = { message: string; code?: string } | null

interface SelectChain {
  single: () => Promise<{ data: Row | null; error: DbError }>
  maybeSingle: () => Promise<{ data: Row | null; error: DbError }>
}

interface EqChain {
  eq: (col: string, val: unknown) => EqChain
  is: (col: string, val: unknown) => EqChain
  single: () => Promise<{ data: Row | null; error: DbError }>
  then: Promise<{ data: null; error: DbError }>['then']
}

interface MutTable {
  insert: (data: Row) => { select: (cols: string) => SelectChain }
  update: (data: Row) => EqChain
  upsert: (data: Row, opts?: Row) => Promise<{ data: null; error: DbError }>
}

export function mut(sb: SB, table: string): MutTable {
  return sb.from(table) as unknown as MutTable
}
