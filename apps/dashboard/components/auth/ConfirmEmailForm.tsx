'use client'
import Link from 'next/link'
import { verifyEmailToken, retryAuthCompletion } from '../../lib/actions/auth'
import { AuthStatus, useAuthAction } from './auth-form'
import styles from '../../app/auth/login/login.module.css'
export default function ConfirmEmailForm({ tokenHash, flow, next }: { tokenHash: string; flow: string; next: string }) {
  const verify = useAuthAction(verifyEmailToken)
  const retry = useAuthAction(retryAuthCompletion)
  const completion = verify.state?.code === 'COMPLETE_PENDING'
  const action = completion ? retry : verify
  return <form ref={action.ref} onSubmit={action.onSubmit} action={action.dispatch} className={styles.form} aria-busy={action.pending}>
    <header className={styles.formHeading}><h1>{flow === 'recovery' ? 'Şifreni yenile' : 'Devam etmeye hazırsın'}<span className={styles.period}>.</span></h1><p>{flow === 'recovery' ? 'Yeni şifreni belirlemek için güvenli bağlantıyı doğrula.' : 'E-postandaki bağlantıyı doğrulayarak Masabu’ya devam et.'}</p></header>
    <input type="hidden" name="token_hash" value={tokenHash}/><input type="hidden" name="flow" value={flow}/><input type="hidden" name="next" value={next}/>
    <AuthStatus state={action.state}/>
    <button className={styles.primaryButton} disabled={action.pending}>{action.pending ? 'Doğrulanıyor…' : completion ? 'Oturumu tamamla' : 'Doğrula ve devam et'}</button>
    <Link className={styles.backButton} href={'/auth/login?' + new URLSearchParams({ next, mode: flow === 'recovery' ? 'forgot' : 'email' }).toString()}>Yeni e-posta iste</Link>
  </form>
}
