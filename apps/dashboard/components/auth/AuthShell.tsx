import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import LoginShowcase from './LoginShowcase'
import styles from '../../app/auth/login/login.module.css'
export default function AuthShell({ children }: { children: ReactNode }) {
  const marketing = process.env['NEXT_PUBLIC_MARKETING_URL'] ?? 'https://masabu.co'
  return <div className={styles.page}><main className={styles.authPanel}><section className={styles.authContent}>
    <Link href={marketing} aria-label="Masabu ana sayfasına dön" className={styles.logoLink}><Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={126} height={34} priority /></Link>
    {children}
    <footer className={styles.authFooter}><Link href={marketing + '/yasal/gizlilik-politikasi'}>Gizlilik</Link><span> · </span><Link href={marketing + '/yasal/abonelik-hizmet-sozlesmesi'}>Hizmet sözleşmesi</Link></footer>
  </section></main><LoginShowcase /></div>
}
