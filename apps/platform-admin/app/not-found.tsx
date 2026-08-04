import { RecoveryScreen } from "@garsonless/ui";

export default function PlatformAdminNotFound() {
  return (
    <RecoveryScreen
      kind="not-found"
      title="Bu platform sayfası bulunamadı"
      description="Adres değişmiş veya yetkili araç henüz kullanıma açılmamış olabilir."
      code="MAS-ROUTE-404"
      homeHref="/"
      homeLabel="Platform ana sayfasına dön"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  );
}
