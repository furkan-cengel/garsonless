// Keep this aligned with the provider email OTP length (6).
export const EMAIL_VERIFICATION_CODE_PATTERN = '[0-9]{6}'
export const EMAIL_VERIFICATION_CODE_ERROR = 'E-postandaki 6 haneli kodun tamamını gir.'

export function normalizeEmailVerificationCode(value: string): string {
  // Preserve leading zeros and every digit; never turn an overlong code into another code.
  return value.replace(/\s/g, '')
}
