import { safeCallbackPath } from '../../../lib/auth/callback-path'
import AuthShell from '../../../components/auth/AuthShell'
import ResetPasswordForm from '../../../components/auth/ResetPasswordForm'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { validatedFlowSession } from '../../../lib/auth/flow-session'
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams
  const client = await createDashboardServerClient({ authOnly: true })
  const valid = Boolean(await validatedFlowSession(client, 'recovery'))
  return <AuthShell><ResetPasswordForm valid={valid} next={safeCallbackPath(query.next ?? null)}/></AuthShell>
}
