export const BILLING_RECONCILIATION_PROJECT_REFS = {
  dev: 'yxsegwkzyiscrxiwdeuf',
  prod: 'svxvloeosiksqfadgkvo',
} as const

const IYZICO_ORIGINS = {
  dev: 'https://sandbox-api.iyzipay.com',
  prod: 'https://api.iyzipay.com',
} as const

const SUBJECT_ID_FLAGS = {
  subscription_refund: '--refund-id',
  refund_cancellation: '--cancellation-target-id',
} as const

type BillingReconciliationTarget = keyof typeof BILLING_RECONCILIATION_PROJECT_REFS
export type BillingReconciliationSubject = keyof typeof SUBJECT_ID_FLAGS

export type BillingReconciliationOperatorPlan = {
  subject: BillingReconciliationSubject
  target: BillingReconciliationTarget
  apply: boolean
  projectRef: string
  supabaseUrl: string
  serviceRoleKey: string
  providerBaseUrl: string
  providerApiKey: string
  providerSecretKey: string
  worker: string
  scope: { kind: 'all' } | { kind: 'one'; id: string }
}

function operatorError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

function requiredEnv(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim()
  if (!value) throw operatorError('billing_reconciliation_environment_invalid', `${name}_missing`)
  return value
}

function singleValueArgument(argv: readonly string[], name: string): string | null {
  const prefix = `${name}=`
  const values = argv.filter((argument) => argument.startsWith(prefix))
  if (values.length > 1) {
    throw operatorError('billing_reconciliation_arguments_invalid', `${name}_duplicate`)
  }
  if (values.length === 0) return null
  const value = values[0]!.slice(prefix.length).trim()
  if (!value) throw operatorError('billing_reconciliation_arguments_invalid', `${name}_missing`)
  return value
}

function assertCanonicalSupabaseUrl(url: string, expectedProjectRef: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw operatorError('billing_reconciliation_target_invalid', 'supabase_url_invalid')
  }
  const expectedOrigin = `https://${expectedProjectRef}.supabase.co`
  if (
    parsed.origin !== expectedOrigin
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw operatorError('billing_reconciliation_target_invalid', 'supabase_project_mismatch')
  }
}

function canonicalUuid(value: string, flag: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw operatorError('billing_reconciliation_scope_invalid', `${flag}_must_be_uuid`)
  }
  return value.toLowerCase()
}

export function buildBillingReconciliationOperatorPlan(input: {
  subject: BillingReconciliationSubject
  argv: readonly string[]
  env: Record<string, string | undefined>
}): BillingReconciliationOperatorPlan {
  const argv = input.argv.filter((argument) => argument !== '--')
  const idFlag = SUBJECT_ID_FLAGS[input.subject]
  const allowedValuePrefixes = ['--target=', '--confirm-prod=', `${idFlag}=`]
  const allowedExact = new Set(['--apply', '--all'])
  for (const argument of argv) {
    if (!allowedExact.has(argument)
      && !allowedValuePrefixes.some((prefix) => argument.startsWith(prefix))) {
      throw operatorError(
        'billing_reconciliation_arguments_invalid',
        'unknown_argument',
      )
    }
  }
  if (argv.filter((argument) => argument === '--apply').length > 1
    || argv.filter((argument) => argument === '--all').length > 1) {
    throw operatorError('billing_reconciliation_arguments_invalid', 'duplicate_switch')
  }

  const targetValue = singleValueArgument(argv, '--target')
  if (targetValue !== 'dev' && targetValue !== 'prod') {
    throw operatorError('billing_reconciliation_target_invalid', 'target_must_be_dev_or_prod')
  }
  const target = targetValue
  const projectRef = BILLING_RECONCILIATION_PROJECT_REFS[target]
  const confirmation = singleValueArgument(argv, '--confirm-prod')
  const idValue = singleValueArgument(argv, idFlag)
  const all = argv.includes('--all')

  if (all === Boolean(idValue)) {
    throw operatorError(
      'billing_reconciliation_scope_invalid',
      `exactly_one_of_${idFlag}_or_--all_required`,
    )
  }
  if (target === 'prod') {
    if (all) {
      throw operatorError('billing_reconciliation_scope_invalid', 'production_bulk_scope_forbidden')
    }
    if (confirmation !== projectRef) {
      throw operatorError(
        'billing_reconciliation_confirmation_invalid',
        `--confirm-prod=${projectRef}_required`,
      )
    }
  } else if (confirmation !== null) {
    throw operatorError(
      'billing_reconciliation_confirmation_invalid',
      'confirm_prod_is_only_valid_for_prod',
    )
  }

  const supabaseUrl = requiredEnv(input.env, 'NEXT_PUBLIC_SUPABASE_URL')
  assertCanonicalSupabaseUrl(supabaseUrl, projectRef)
  const providerBaseUrl = requiredEnv(input.env, 'IYZICO_BILLING_BASE_URL')
  if (providerBaseUrl !== IYZICO_ORIGINS[target]) {
    throw operatorError('billing_reconciliation_target_invalid', 'provider_origin_mismatch')
  }

  return {
    subject: input.subject,
    target,
    apply: argv.includes('--apply'),
    projectRef,
    supabaseUrl,
    serviceRoleKey: requiredEnv(input.env, 'SUPABASE_SERVICE_ROLE_KEY'),
    providerBaseUrl,
    providerApiKey: requiredEnv(input.env, 'IYZICO_BILLING_API_KEY'),
    providerSecretKey: requiredEnv(input.env, 'IYZICO_BILLING_SECRET_KEY'),
    worker: `${target}-${input.subject.replaceAll('_', '-')}-operator`,
    scope: all
      ? { kind: 'all' }
      : { kind: 'one', id: canonicalUuid(idValue as string, idFlag) },
  }
}

export function billingReconciliationOperatorSummary(
  plan: BillingReconciliationOperatorPlan,
): Record<string, unknown> {
  return {
    result: 'operator_plan',
    subject: plan.subject,
    target: plan.target,
    projectRef: plan.projectRef,
    apply: plan.apply,
    scope: plan.scope,
  }
}
