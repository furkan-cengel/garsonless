import { MarketingNav } from '../components/MarketingNav'
import { HeroSection } from '../components/HeroSection'
import { ProblemSolutionSection } from '../components/ProblemSolutionSection'
import { ProcessFlowSection } from '../components/ProcessFlowSection'
import { MenuCustomizationSection } from '../components/MenuCustomizationSection'
import { OperationsBentoSection } from '../components/OperationsBentoSection'
import { TrialSection } from '../components/TrialSection'
import { FAQSection } from '../components/FAQSection'
import { CTASection } from '../components/CTASection'
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
        <OperationsBentoSection />
        <TrialSection />
        <FAQSection />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}
