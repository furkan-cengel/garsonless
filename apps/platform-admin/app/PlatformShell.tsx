import Link from 'next/link'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { signOut } from './actions'

export function PlatformShell({
  actor,
  children,
}: {
  actor: PlatformAdminActorContext
  children: React.ReactNode
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">M</span><span>Masabu Platform</span></Link>
        <div className="topbar-actions">
          <span className="badge">MFA · {actor.role}</span>
          <form action={signOut}><button className="button" type="submit">Çıkış yap</button></form>
        </div>
      </header>
      {children}
    </main>
  )
}
