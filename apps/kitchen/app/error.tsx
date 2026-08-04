"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@garsonless/ui";

export default function KitchenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[kitchen-route-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <RecoveryScreen
      kind="error"
      title="Mutfak ekranı açılamadı"
      description="Ekranı yeniden deneyin. Sorun devam ederse bağlantıyı ve istasyon yetkisini kontrol edin."
      code="MAS-UI-500"
      onRetry={reset}
      homeHref="/"
      homeLabel="Başlangıca dön"
      appearance="dark"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  );
}
