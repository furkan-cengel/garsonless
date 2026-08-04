"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@garsonless/ui";

export default function PlatformAdminGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[platform-admin-global-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <RecoveryScreen
          kind="error"
          title="Platform başlatılamadı"
          description="Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin."
          code="MAS-UI-500"
          onRetry={reset}
          homeHref="/"
          homeLabel="Platform ana sayfasına dön"
          statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
        />
      </body>
    </html>
  );
}
