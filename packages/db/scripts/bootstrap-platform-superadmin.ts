import { randomUUID } from 'node:crypto'
import { createServiceClient } from '../src/client'

function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

async function findAuthUserId(email: string): Promise<string> {
  const service = createServiceClient()
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('Platform owner auth identity could not be resolved')
    const match = data.users.find((user) => user.email?.toLocaleLowerCase('en-US') === email.toLocaleLowerCase('en-US'))
    if (match) return match.id
    if (data.users.length < 200) break
  }
  throw new Error('Platform owner auth identity was not found')
}

async function main() {
  const email = env('PLATFORM_ADMIN_EMAIL')
  const displayName = process.env.PLATFORM_ADMIN_DISPLAY_NAME?.trim() || 'Masabu Owner'
  const reason = env('PLATFORM_ADMIN_REASON')
  if (displayName.length > 120) throw new Error('PLATFORM_ADMIN_DISPLAY_NAME is too long')
  if (reason.length < 10 || reason.length > 1000) throw new Error('PLATFORM_ADMIN_REASON must be 10-1000 characters')

  const userId = await findAuthUserId(email)
  const requestId = process.env.PLATFORM_ADMIN_REQUEST_ID?.trim() || randomUUID()
  const service = createServiceClient()
  type BootstrapRpc = (
    name: 'bootstrap_platform_superadmin',
    args: { p_user_id: string; p_display_name: string; p_reason: string; p_request_id: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  const rpc = service.rpc.bind(service) as unknown as BootstrapRpc
  const { data, error } = await rpc('bootstrap_platform_superadmin', {
    p_user_id: userId,
    p_display_name: displayName,
    p_reason: reason,
    p_request_id: requestId,
  })
  if (error) throw new Error('Platform owner bootstrap was rejected')
  const row = data as { duplicate?: unknown } | null
  if (!row || typeof row.duplicate !== 'boolean') throw new Error('Platform owner bootstrap returned an invalid result')
  console.log(JSON.stringify({
    success: true,
    duplicate: row.duplicate,
    userIdSuffix: userId.slice(-6),
    requestId,
  }, null, 2))
}

void main()
