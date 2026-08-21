import type { ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
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
