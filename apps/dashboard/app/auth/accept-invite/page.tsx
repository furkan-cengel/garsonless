import { resolveInviteByToken } from '@garsonless/db/server'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import AcceptInviteClient from '../../../components/auth/AcceptInviteClient'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) return <AcceptInviteClient state="invalid" />

  const invite = await resolveInviteByToken(token)
  if (!invite) return <AcceptInviteClient state="invalid" />

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const next = `/auth/accept-invite?token=${encodeURIComponent(token)}`

  if (!user) {
    return (
      <AcceptInviteClient
        state="anon"
        restaurantName={invite.restaurantName}
        email={invite.email}
        permissions={invite.permissions}
        next={next}
      />
    )
  }

  const match = (user.email ?? '').trim().toLowerCase() === invite.email.toLowerCase()
  if (!match) {
    return <AcceptInviteClient state="mismatch" inviteEmail={invite.email} currentEmail={user.email ?? ''} />
  }

  return (
    <AcceptInviteClient
      state="match"
      token={token}
      restaurantName={invite.restaurantName}
      email={invite.email}
      permissions={invite.permissions}
    />
  )
}
