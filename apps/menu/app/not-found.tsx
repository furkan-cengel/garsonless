import { RecoveryScreen } from '@garsonless/ui'

export default function MenuNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu menü sayfası bulunamadı"
      description="QR bağlantısı eski olabilir. Restoran personelinden güncel QR kodu isteyebilirsiniz."
      code="MAS-ROUTE-404"
      homeHref="/"
      homeLabel="Ana sayfaya dön"
    />
  )
}
