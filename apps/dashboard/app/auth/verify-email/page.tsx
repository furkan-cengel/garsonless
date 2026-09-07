import { redirect } from 'next/navigation'
import AuthShell from '../../../components/auth/AuthShell'
import VerifyEmailForm from '../../../components/auth/VerifyEmailForm'
import { readEntryContext, type AuthEntryQuery } from '../../../lib/auth/entry-context'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import { emailSchema } from '../../../lib/auth/password-policy'
import { getFlowGrant, validatedFlowSession } from '../../../lib/auth/flow-session'
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<AuthEntryQuery> }) {
  const query = await searchParams
  const email = emailSchema.safeParse(query.email)
  if (!email.success) redirect('/auth/signup')
  const sent = await getFlowGrant('sent')
  const complete = await getFlowGrant('complete')
  const verified = complete ? await validatedFlowSession(await createDashboardServerClient({ authOnly: true }), 'complete') : null
  const cooldown = sent?.userId === email.data ? Math.max(0, Math.ceil((sent.expiresAt - 540_000 - Date.now()) / 1000)) : 0
  return <AuthShell><VerifyEmailForm email={email.data} next={readEntryContext(query, true).next} sent={sent?.userId === email.data && sent.sessionId === 'signup'} initialCooldown={cooldown} pendingCompletion={verified?.user.email === email.data}/></AuthShell>
}
