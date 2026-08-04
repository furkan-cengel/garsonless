import { NextResponse } from 'next/server'
import {
  apiFailure,
  apiSuccess,
  statusForCustomerAuthError,
  type ApiResult,
  type CustomerAuthErrorCode,
} from './customer-auth-contract'

export function customerAuthErrorResponse(
  code: CustomerAuthErrorCode,
  retryAfterSeconds?: number,
): NextResponse<ApiResult<never>> {
  const response = NextResponse.json(apiFailure(code, retryAfterSeconds), {
    status: statusForCustomerAuthError(code),
  })
  if (retryAfterSeconds !== undefined) response.headers.set('Retry-After', String(retryAfterSeconds))
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function customerAuthSuccessResponse<T>(data: T): NextResponse<ApiResult<T>> {
  const response = NextResponse.json(apiSuccess(data))
  response.headers.set('Cache-Control', 'no-store')
  return response
}
