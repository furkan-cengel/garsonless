import { marketingMetadata } from '../../lib/seo'
import { MenuRegulationPage } from '../../components/MenuRegulationPage'

// Refresh the countdown instead of freezing it at deployment time.
export const revalidate = 3600

export const metadata = marketingMetadata({
  title: 'Menüde Alerjen ve İçerik Bildirimi Zorunluluğu | masabu',
  description:
    'Kafe ve restoranlar için menüde alerjen, bileşen ve kalori bildirimi rehberi. 2026–2027 uyum takvimi, 14 temel alerjen ve karekodla bilgilendirme.',
  canonical: '/menu-alerjen-zorunlulugu',
})

export default function Page() {
  return <MenuRegulationPage />
}
