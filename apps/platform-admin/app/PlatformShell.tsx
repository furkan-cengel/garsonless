import { platformAdminCan } from '@garsonless/domain/platform-admin'
import Link from 'next/link'
import type { PlatformAdminActorContext } from '@garsonless/domain/platform-admin'
import { signOut } from './actions'
import { platformRoleLabel } from '../lib/tenant-presentation'

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
        <div className="topbar-start">
          <Link className="brand" href="/"><span className="brand-mark">M</span><span>masabu Platform</span></Link>
          <nav aria-label="Platform bölümleri" className="platform-nav">
            <Link href="/">İşletmeler</Link>
            <Link href="/errors">Hata merkezi</Link>
            {platformAdminCan(actor, 'catalog.manage') && <Link href="/add-ons">Eklentiler</Link>}
          </nav>
        </div>
        <div className="topbar-actions">
          <span className="badge">2 adımlı doğrulama · {platformRoleLabel(actor.role)}</span>
          <form action={signOut}><button className="button" type="submit">Çıkış yap</button></form>
        </div>
      </header>
      {children}
    </main>
  )
}
