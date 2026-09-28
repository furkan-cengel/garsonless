import { marketingMetadata } from '../../lib/seo'
import { MenuRegulationPage } from '../../components/MenuRegulationPage'

// Refresh the countdown instead of freezing it at deployment time.
export const revalidate = 3600

export const metadata = marketingMetadata({
  title: 'Menüde Alerjen ve İçerik Bildirimi Zorunluluğu | masabu',
  description:
    'Menüde alerjen, bileşen ve kalori bildirimi için 2026–2027 uyum takvimini inceleyin. Masabu ile dijital menünüzü hazırlamak için ücretsiz kurulum görüşmesi alın.',
  canonical: '/menu-alerjen-zorunlulugu',
})

export default function Page() {
  return <MenuRegulationPage />
}
