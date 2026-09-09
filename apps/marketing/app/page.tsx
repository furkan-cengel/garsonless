import { organizationGraph, serializeJsonLd } from '../lib/seo'
import type { Metadata } from 'next'
import { MarketingNav } from '../components/MarketingNav'
import { HeroSection } from '../components/HeroSection'
import { ProblemSolutionSection } from '../components/ProblemSolutionSection'
import { ProcessFlowSection } from '../components/ProcessFlowSection'
import { MenuCustomizationSection } from '../components/MenuCustomizationSection'
import { PricingSection } from '../components/PricingSection'
import { TrialSection } from '../components/TrialSection'
import { FAQSection } from '../components/FAQSection'
import { MarketingFooter } from '../components/MarketingFooter'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationGraph()) }} />
      <MarketingNav />
      <main>
        <HeroSection />
        <ProblemSolutionSection />
        <ProcessFlowSection />
        <MenuCustomizationSection />
        <PricingSection />
        <TrialSection />
        <FAQSection />
      </main>
      <MarketingFooter />
    </>
  )
}
