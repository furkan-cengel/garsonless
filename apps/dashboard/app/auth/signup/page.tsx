import AuthShell from '../../../components/auth/AuthShell'
import AuthEntry from '../../../components/auth/AuthEntry'
import { readEntryContext, type AuthEntryQuery } from '../../../lib/auth/entry-context'
export default async function SignupPage({ searchParams }: { searchParams: Promise<AuthEntryQuery> }) {
  const query = await searchParams
  return <AuthShell><AuthEntry signup context={readEntryContext(query, true)} initialEmail={typeof query.email === 'string' ? query.email : ''}/></AuthShell>
}
