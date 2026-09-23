import { safeReturnPath } from '@garsonless/domain/navigation'

export function safeCallbackPath(value: string | null, fallback = '/dashboard'): string {
  return safeReturnPath(value, fallback)
}
