import { MarketingNav } from '../components/MarketingNav'
import { HeroSection } from '../components/HeroSection'
import { LogoStrip } from '../components/LogoStrip'
import { FeaturesGrid } from '../components/FeaturesGrid'
import { DemoVideo } from '../components/DemoVideo'
import { TestimonialsSection } from '../components/TestimonialsSection'
import { PricingSection } from '../components/PricingSection'
import { IntegrationsSection } from '../components/IntegrationsSection'
import { FAQSection } from '../components/FAQSection'
import { ResourcesTeaser } from '../components/ResourcesTeaser'
import { CTASection } from '../components/CTASection'
import { MarketingFooter } from '../components/MarketingFooter'

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <HeroSection />
        <LogoStrip />
        <FeaturesGrid />
        <DemoVideo />
        <TestimonialsSection />
        <PricingSection />
        <IntegrationsSection />
        <FAQSection />
        <ResourcesTeaser />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  )
}
