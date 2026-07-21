import { RecoveryScreen } from '@garsonless/ui'

export default function KitchenNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu mutfak ekranı bulunamadı"
      description="Bağlantı eski olabilir veya istasyon erişimi kaldırılmış olabilir."
      code="MAS-ROUTE-404"
      homeHref="/"
      homeLabel="Başlangıca dön"
      dark
    />
  )
}
