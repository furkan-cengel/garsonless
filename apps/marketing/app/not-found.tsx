import { RecoveryScreen } from '@garsonless/ui/errors'

export default function MarketingNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu sayfa bulunamadı"
      description="Bağlantı değişmiş veya kaldırılmış olabilir."
      code="MAS-ROUTE-404"
      homeHref="/"
      homeLabel="Ana sayfaya dön"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  )
}
