"use client";

import { useEffect, useMemo, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RecoveryScreen } from "@garsonless/ui/errors";
import { routeErrorDetails } from "../components/errors/route-error-details";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const details = useMemo(() => routeErrorDetails(error, pathname), [error, pathname]);

  useEffect(() => {
    console.error(
      "[dashboard-route-error]",
      { publicCode: "MAS-UI-500", digest: error.digest },
      error,
    );
  }, [error]);

  return (
    <RecoveryScreen
      kind="error"
      title="Bir şeyler ters gitti"
      description="Bu ekran şu anda açılamadı. Kayıtlı verilerin etkilenmedi; tekrar deneyebilir veya panoya dönebilirsin."
      code="MAS-UI-500"
      // reset() alone re-renders the same cached segment; refresh refetches it first.
      onRetry={() => startTransition(() => { router.refresh(); reset(); })}
      homeHref="/dashboard"
      homeLabel="Panoya dön"
      statusHref={process.env.NEXT_PUBLIC_STATUS_URL}
      details={details}
    />
  );
}
