import AuthShell from '../../../components/auth/AuthShell'
import AuthEntry from '../../../components/auth/AuthEntry'
import { readEntryContext, callbackMessage, type AuthEntryQuery } from '../../../lib/auth/entry-context'
export default async function LoginPage({ searchParams }: { searchParams: Promise<AuthEntryQuery> }) {
  const query = await searchParams
  return <AuthShell><AuthEntry context={readEntryContext(query)} initialEmail={typeof query.email === 'string' ? query.email : ''} initialMode={query.mode === 'forgot' ? 'forgot' : query.mode === 'email' ? 'email' : 'password'} messageKind={!callbackMessage(query.error) && query.success === 'password-reset' ? 'success' : 'error'} message={callbackMessage(query.error) ?? (query.success === 'password-reset' ? 'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.' : undefined)}/></AuthShell>
}
