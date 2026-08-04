"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@garsonless/ui";

export default function PlatformAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[platform-admin-route-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <RecoveryScreen
      kind="error"
      title="Platform ekranı açılamadı"
      description="Bu araç şu anda kullanılamıyor. Tekrar deneyebilir veya platform ana sayfasına dönebilirsiniz."
      code="MAS-UI-500"
      onRetry={reset}
      homeHref="/"
      homeLabel="Platform ana sayfasına dön"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
    />
  );
}
