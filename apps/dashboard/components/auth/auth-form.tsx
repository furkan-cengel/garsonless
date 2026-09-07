'use client'
import { useActionState, useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { I } from '../../lib/ui'
import type { AuthActionState } from '../../lib/auth/entry-context'
import styles from '../../app/auth/login/login.module.css'
export function useAuthAction(action: (previous: unknown, data: FormData) => Promise<AuthActionState>) {
  const ref = useRef<HTMLFormElement>(null)
  const lock = useRef(false)
  const submitted = useRef(false)
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitted.current) event.preventDefault()
    else submitted.current = true
  }
  const [state, dispatch, pending] = useActionState(async (previous: AuthActionState | null, data: FormData): Promise<AuthActionState> => {
    if (lock.current) return previous ?? {}
    lock.current = true
    try { return await action(previous, data) } catch (error) {
      unstable_rethrow(error)
      return { error: 'Bağlantı kurulamadı. Bilgilerin korundu; tekrar deneyebilirsin.', code: 'UNAVAILABLE' }
    } finally { lock.current = false; submitted.current = false }
  }, null)
  useEffect(() => {
    if (state?.error) {
      const first = Object.keys(state.fieldErrors ?? {})[0]
      const field = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? (first ? ref.current?.elements.namedItem(first) : null)
      if (field instanceof HTMLElement) field.focus()
      else ref.current?.querySelector<HTMLElement>('[role="alert"]')?.focus()
    }
  }, [state])
  return { state, dispatch, pending, ref, onSubmit }
}
export function AuthField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId()
  const [show, setShow] = useState(false)
  const password = props.type === 'password'
  return <div className={styles.field}><label className={styles.fieldLabel} htmlFor={id}>{label}</label>
    <div className={styles.inputShell}><span className={styles.inputIcon} aria-hidden="true">{password ? <I.lock size={18}/> : props.type === 'email' ? <I.mail size={18}/> : <I.user size={18}/>}</span>
      <input {...props} id={id} type={password && show ? 'text' : props.type} className={styles.input} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : props['aria-describedby']} />
      {password && <button type="button" className={styles.inputAction} onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>{show ? <I.eyeOff size={18}/> : <I.eye size={18}/>}</button>}
    </div>
    {error && <p id={id + '-error'} className={styles.fieldError}>{error}</p>}
  </div>
}
export function AuthStatus({ state }: { state: AuthActionState | null }) {
  return state?.error ? <div role="alert" tabIndex={-1} className={styles.formError}>{state.error}</div> : null
}
export function useResendCountdown(state: AuthActionState | null, initial = 0) {
  const [remaining, setRemaining] = useState(initial)
  useEffect(() => { if (state?.retryAfter) setRemaining(state.retryAfter) }, [state])
  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining(n => Math.max(0, n - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining])
  return remaining
}
