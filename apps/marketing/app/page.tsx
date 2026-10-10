import { readMarketingAddOnPrice } from '../lib/add-on-prices'
import { organizationGraph, serializeJsonLd } from '../lib/seo'
import type { Metadata } from 'next'
import { MarketingNav } from '../components/MarketingNav'
import { MenuInformationSection } from '../components/ConversionSections'
import { SocialProof } from '../components/SocialProof'
import { HeroSection } from '../components/HeroSection'
import { ProblemSolutionSection } from '../components/ProblemSolutionSection'
import { ProcessFlowSection } from '../components/ProcessFlowSection'
import { MenuCustomizationSection } from '../components/MenuCustomizationSection'
import { PricingSection } from '../components/PricingSection'
import { TrialSection } from '../components/TrialSection'
import { FAQSection } from '../components/FAQSection'
import { MarketingFooter } from '../components/MarketingFooter'
import './landing-theme.css'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const addOnPrice = await readMarketingAddOnPrice()
  return (
    <div className="landing-theme">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationGraph()) }} />
      <MarketingNav />
      <main>
        <HeroSection />
        <MenuInformationSection />
        <SocialProof />
        <ProblemSolutionSection />
        <ProcessFlowSection />
        <MenuCustomizationSection />
        <PricingSection addOnPrice={addOnPrice} />
        <TrialSection />
        <FAQSection />
      </main>
      <MarketingFooter />
    </div>
  )
}
