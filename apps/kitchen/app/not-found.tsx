import { RecoveryScreen } from "@garsonless/ui";

export default function KitchenNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu mutfak ekranı bulunamadı"
      description="Bağlantı eski olabilir veya istasyon erişimi kaldırılmış olabilir."
      code="MAS-ROUTE-404"
      homeHref="/"
      homeLabel="Başlangıca dön"
      appearance="dark"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  );
}
