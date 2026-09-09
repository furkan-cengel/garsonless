import { Breadcrumbs, type Breadcrumb } from './Breadcrumbs'
import type { ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'

export function MarketingPage({ children, breadcrumbs }: { children: ReactNode; breadcrumbs?: readonly Breadcrumb[] }) {
  return (
    <>
      <MarketingNav />
      <main>{breadcrumbs && <Breadcrumbs items={breadcrumbs} />}{children}</main>
      <MarketingFooter />
    </>
  )
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: ReactNode
  description: string
}) {
  return (
    <header className="subpage-hero">
      <div className="container subpage-hero__inner">
        <p className="subpage-eyebrow">{eyebrow}</p>
        <h1 className="font-display">{title}</h1>
        <p className="subpage-hero__description">{description}</p>
      </div>
    </header>
  )
}
