import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import LoginShowcase from '../../../components/auth/LoginShowcase'
import VerifyEmailForm from '../../../components/auth/VerifyEmailForm'
import { safeCallbackPath } from '../../../lib/auth/callback-path'
import styles from '../login/login.module.css'

interface Props {
  searchParams: Promise<{ email?: string; next?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const query = await searchParams
  if (!query.email) redirect('/auth/signup')
  const next = safeCallbackPath(query.next ?? null)

  return (
    <div className={styles.page}>
      <main className={`${styles.authPanel} ${styles.signupPanel}`}>
        <section className={`${styles.authContent} ${styles.signupContent}`}>
          <Link href="https://masabu.co" aria-label="Masabu ana sayfasına dön" className={styles.logoLink}>
            <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={126} height={34} priority />
          </Link>
          <VerifyEmailForm email={query.email} next={next} />
          <footer className={styles.authFooter}>E-posta doğrulanmadan işletme kurulumu başlatılmaz.</footer>
        </section>
      </main>
      <LoginShowcase />
    </div>
  )
}
