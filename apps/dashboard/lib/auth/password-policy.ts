import { z } from 'zod'
import { EMAIL_VERIFICATION_CODE_ERROR, EMAIL_VERIFICATION_CODE_PATTERN, normalizeEmailVerificationCode } from './email-verification-code'
export const NEW_PASSWORD_MIN_LENGTH = 6
export const NEW_PASSWORD_REQUIREMENTS = 'En az 6 karakter; bir büyük harf, bir rakam ve bir özel karakter içermeli.'
export const newPasswordSchema = z.string()
  .min(NEW_PASSWORD_MIN_LENGTH, 'Şifre en az 6 karakter olmalı.')
  .regex(/\p{Lu}/u, 'Şifre en az bir büyük harf içermeli.')
  .regex(/[0-9]/, 'Şifre en az bir rakam içermeli.')
  .regex(/[^\p{L}\p{N}\s]/u, 'Şifre en az bir özel karakter içermeli (ör. !, @, #).')
export const emailSchema = z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir.')

export const emailCodeSchema = z.string({ invalid_type_error: '6 haneli kod gerekli.', required_error: '6 haneli kod gerekli.' }).regex(/^[0-9]{6}$/, '6 haneli kod gerekli.')

export const emailVerificationCodeSchema = z.string({ invalid_type_error: EMAIL_VERIFICATION_CODE_ERROR, required_error: EMAIL_VERIFICATION_CODE_ERROR })
  .transform(normalizeEmailVerificationCode)
  .pipe(z.string().regex(new RegExp(`^${EMAIL_VERIFICATION_CODE_PATTERN}$`), EMAIL_VERIFICATION_CODE_ERROR))
