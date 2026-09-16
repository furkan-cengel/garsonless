import { readMarketingAddOnPrice } from '../../lib/add-on-prices'
import type { Metadata } from 'next'
import { marketingMetadata } from '../../lib/seo'
import { MarketingPage } from '../../components/MarketingPage'
import { PricingPageClient } from '../../components/PricingPageClient'
import { TrialSection } from '../../components/TrialSection'

export const metadata: Metadata = marketingMetadata({
  title: 'QR Menü ve Adisyon Sistemi Fiyatları | masabu',
  description: 'masabu Starter, Plus, Pro ve Business paketlerini; fiyat, özellik, operasyon ve ticari koşullarıyla karşılaştırın.',
  canonical: '/fiyatlar',
})

export default async function PricingPage() {
  const addOnPrice = await readMarketingAddOnPrice()
  return (
    <MarketingPage breadcrumbs={[{ name: 'Fiyatlar', path: '/fiyatlar' }]}>
      <PricingPageClient addOnPrice={addOnPrice} />
      <TrialSection />
    </MarketingPage>
  )
}
