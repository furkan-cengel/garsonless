import type { Metadata } from 'next'
import { MarketingPage } from '../../components/MarketingPage'
import { PricingPageClient } from '../../components/PricingPageClient'
import { TrialSection } from '../../components/TrialSection'

export const metadata: Metadata = {
  title: 'Fiyatlar ve Paket Karşılaştırması | Masabu',
  description: 'Masabu Starter, Plus, Pro ve Business paketlerini; fiyat, özellik, operasyon ve ticari koşullarıyla karşılaştırın.',
  alternates: { canonical: '/fiyatlar' },
  openGraph: {
    title: 'Masabu Fiyatlar ve Paket Karşılaştırması',
    description: 'Restoranınız için Starter, Plus, Pro ve Business paketlerini ayrıntılı karşılaştırın.',
    url: 'https://masabu.co/fiyatlar',
    type: 'website',
  },
}

export default function PricingPage() {
  return (
    <MarketingPage>
      <PricingPageClient />
      <TrialSection />
    </MarketingPage>
  )
}
