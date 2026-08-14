import { MarketingNav } from '../components/MarketingNav'
import { HeroSection } from '../components/HeroSection'
import { ProblemSolutionSection } from '../components/ProblemSolutionSection'
import { ProcessFlowSection } from '../components/ProcessFlowSection'
import { MenuCustomizationSection } from '../components/MenuCustomizationSection'
import { PricingSection } from '../components/PricingSection'
import { TrialSection } from '../components/TrialSection'
import { FAQSection } from '../components/FAQSection'
import { MarketingFooter } from '../components/MarketingFooter'

export default function HomePage() {
  return (
    <>
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
