'use server'

import { z } from 'zod'
import { consumeDashboardAuthRateLimit } from '@garsonless/db/server'
import { sanitizeServerDiagnostic } from '../server-log-redaction'
import { createDashboardServerClient } from '../supabase-server'

const reportSchema = z.object({
  screen: z.string().trim().min(1).max(40).regex(/^[a-z-]+$/),
  pathname: z.string().max(200),
  name: z.string().max(80),
  message: z.string().max(500),
  stack: z.string().max(2_000).optional(),
}).strict()

export type ClientErrorReport = z.infer<typeof reportSchema>

/**
 * Writes a browser-side render error to the server log so support can find it
 * by time and screen. Server errors are already logged by Next.js with their
 * digest, so callers only send errors that have none. Only a signed-in
 * dashboard user can report, and the rate limit is keyed on that verified user.
 * The result is always void: reporting must never change what the user sees.
 */
export async function reportClientErrorAction(report: ClientErrorReport): Promise<void> {
  try {
    const parsed = reportSchema.safeParse(report)
    if (!parsed.success) return
    const supabase = await createDashboardServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const limit = await consumeDashboardAuthRateLimit({ action: 'client_error_report', subject: `user:${user.id}`, limit: 20, windowSeconds: 3600 })
    if (!limit.ok || !limit.allowed) return
    // Paths carry restaurant ids and messages can carry user input; the redactor masks ids, emails and phones.
    console.error('[dashboard-client-error]', sanitizeServerDiagnostic({ publicCode: 'MAS-UI-500', ...parsed.data }))
  } catch {
    // Never let a failed report surface as a second error.
  }
}
