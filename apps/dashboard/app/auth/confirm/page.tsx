import type { Metadata } from 'next'
import AuthShell from '../../../components/auth/AuthShell'
import ConfirmEmailForm from '../../../components/auth/ConfirmEmailForm'
import { safeCallbackPath } from '../../../lib/auth/callback-path'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false, follow: false } }
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; flow?: string; next?: string }> }) {
  const query = await searchParams
  return <AuthShell><ConfirmEmailForm tokenHash={query.token_hash ?? ''} flow={query.flow ?? ''} next={safeCallbackPath(query.next ?? null)}/></AuthShell>
}
