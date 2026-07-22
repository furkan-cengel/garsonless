import { createHmac, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  readPlatformAdminIdentity,
  resolvePlatformAdminActor,
} from '@garsonless/application/platform-admin'
import { createServiceClient } from '../src/client'
import { createPlatformAdminIdentityPort } from '../src/platform-admin-identity-port'
import type { Database } from '../src/types.gen'

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of value.toUpperCase().replace(/=+$/g, '')) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('Invalid TOTP secret')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }
  return Buffer.from(bytes)
}

function totp(secret: string, now = Date.now()): string {
  const counter = Math.floor(now / 30_000)
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(number).padStart(6, '0')
}

async function main() {
  const service = createServiceClient()
  const email = `platform-admin-runtime-${Date.now()}@example.test`
  const password = `${randomBytes(18).toString('base64url')}A!9`
  let userId: string | null = null

  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) throw createError ?? new Error('Auth user not created')
    userId = created.user.id

    const port = createPlatformAdminIdentityPort()
    const beforeMembership = await readPlatformAdminIdentity(userId, port)

    const { error: insertError } = await service.from('platform_admin_users').insert({
      user_id: userId,
      role: 'ops',
      status: 'active',
      display_name: 'Runtime Ops',
      activated_at: new Date().toISOString(),
    })
    if (insertError) throw insertError

    const anon = createSupabaseClient<Database>(
      env('NEXT_PUBLIC_SUPABASE_URL'),
      env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const unauthTable = await anon.from('platform_admin_users').select('user_id').limit(1)
    const unauthRpc = await anon.rpc('read_platform_admin_identity', { p_user_id: userId })

    const { error: signInError } = await anon.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
    const authenticatedTable = await anon.from('platform_admin_users').select('user_id').limit(1)
    const authenticatedRpc = await anon.rpc('read_platform_admin_identity', { p_user_id: userId })

    const { data: beforeAal } = await anon.auth.mfa.getAuthenticatorAssuranceLevel()
    const beforeActor = await resolvePlatformAdminActor(
      { userId, currentAal: beforeAal?.currentLevel === 'aal1' ? 'aal1' : null },
      port,
    )

    const { data: enrollment, error: enrollError } = await anon.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Masabu Platform Runtime',
    })
    if (enrollError) throw enrollError
    const { error: verifyError } = await anon.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code: totp(enrollment.totp.secret),
    })
    if (verifyError) throw verifyError

    const { data: afterAal } = await anon.auth.mfa.getAuthenticatorAssuranceLevel()
    const afterActor = await resolvePlatformAdminActor(
      { userId, currentAal: afterAal?.currentLevel === 'aal2' ? 'aal2' : null },
      port,
    )

    const { error: suspendError } = await service
      .from('platform_admin_users')
      .update({ status: 'suspended' })
      .eq('user_id', userId)
    if (suspendError) throw suspendError
    const suspendedActor = await resolvePlatformAdminActor(
      { userId, currentAal: 'aal2' },
      port,
    )

    console.log(JSON.stringify({
      project: new URL(env('NEXT_PUBLIC_SUPABASE_URL')).hostname,
      beforeMembership,
      publicBoundary: {
        anonTableCode: unauthTable.error?.code ?? null,
        anonRpcCode: unauthRpc.error?.code ?? null,
        authenticatedTableCode: authenticatedTable.error?.code ?? null,
        authenticatedRpcCode: authenticatedRpc.error?.code ?? null,
      },
      mfa: {
        beforeLevel: beforeAal?.currentLevel ?? null,
        beforeActor,
        afterLevel: afterAal?.currentLevel ?? null,
        afterActor,
      },
      suspendedActor,
    }, null, 2))
  } finally {
    if (userId) {
      await service.from('platform_admin_users').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      const { count } = await service
        .from('platform_admin_users')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      console.log(JSON.stringify({ cleanup: { platformAdminRows: count ?? -1 } }))
    }
  }
}

void main()
