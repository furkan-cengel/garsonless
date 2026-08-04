"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@garsonless/ui";

export default function KitchenGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[kitchen-global-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <RecoveryScreen
          kind="error"
          title="Mutfak ekranı başlatılamadı"
          description="Kısa süre sonra tekrar deneyin."
          code="MAS-UI-500"
          onRetry={reset}
          homeHref="/"
          homeLabel="Başlangıca dön"
          appearance="dark"
          statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
        />
      </body>
    </html>
  );
}
