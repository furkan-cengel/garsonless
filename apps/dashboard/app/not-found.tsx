import { RecoveryScreen } from '@garsonless/ui'

export default function DashboardNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu sayfa bulunamadı"
      description="Bağlantı değişmiş olabilir ya da bu alana erişiminiz olmayabilir."
      code="MAS-ROUTE-404"
      homeHref="/dashboard"
      homeLabel="Panoya dön"
    />
  )
}
