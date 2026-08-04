"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@garsonless/ui";

export default function MenuGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[menu-global-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <RecoveryScreen
          kind="error"
          title="Menü şu anda kullanılamıyor"
          description="Kısa süre sonra tekrar deneyin."
          code="MAS-UI-500"
          onRetry={reset}
          homeHref="/"
          homeLabel="Ana sayfaya dön"
          statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
        />
      </body>
    </html>
  );
}
