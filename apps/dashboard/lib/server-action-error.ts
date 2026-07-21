import 'server-only'

import { randomUUID } from 'node:crypto'
import {
  createActionFailure,
  type ActionFailure,
  type ErrorCode,
} from '@garsonless/domain/errors'

type DashboardFailureOptions = {
  operation: string
  /** Only use a message which is already known to be safe for the dashboard UI. */
  message?: string
  cause?: unknown
}

export type DashboardActionFailure = ActionFailure

function buildReferenceId() {
  return `DASH-${randomUUID().slice(0, 8).toUpperCase()}`
}

/**
 * Converts server-side failures into a stable client envelope and correlates
 * their private diagnostic detail in server logs. Never add `cause` to return.
 */
export function dashboardActionFailure(
  errorCode: ErrorCode,
  { operation, message, cause }: DashboardFailureOptions,
): DashboardActionFailure {
  const referenceId = buildReferenceId()
  const failure = createActionFailure(errorCode, { message, referenceId })
  const log = {
    operation,
    errorCode: failure.errorCode,
    publicCode: failure.publicCode,
    referenceId,
  }

  if (cause) {
    console.error('[dashboard-action-failure]', log, cause)
  } else {
    console.warn('[dashboard-action-failure]', log)
  }

  return failure
}

export function dashboardAccessFailure(error: string, operation: string) {
  return dashboardActionFailure(error === 'Not authenticated' ? 'AUTH_REQUIRED' : 'ACCESS_DENIED', {
    operation,
  })
}

/** Maps known application outcomes without forwarding an implementation error. */
export function dashboardOrderFailure(error: string, operation: string) {
  const normalized = error.toLocaleLowerCase('tr-TR')
  if (normalized.includes('bulunamad') || normalized.includes('not found')) {
    return dashboardActionFailure('RESOURCE_NOT_FOUND', { operation })
  }
  if (normalized.includes('iptal') && (normalized.includes('ödeme') || normalized.includes('i̇yzico') || normalized.includes('iyzico'))) {
    return dashboardActionFailure('PAYMENT_ACTION_REQUIRED', { operation, message: error })
  }
  if (normalized.includes('durum') || normalized.includes('transition') || normalized.includes('geçirilemez')) {
    return dashboardActionFailure('INVALID_STATE_TRANSITION', { operation })
  }
  return dashboardActionFailure('CONFLICT', { operation })
}
