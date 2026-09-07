import { redirect } from "next/navigation";
import { LEGAL_DOCUMENT_VERSION } from "@garsonless/domain/legal";
import { hasDashboardSignupLegalEvidence } from "@garsonless/db/server";
import AuthShell from "../../../components/auth/AuthShell";
import GoogleTermsForm from "../../../components/auth/GoogleTermsForm";
import { createDashboardAuthClient } from "../../../lib/auth/auth-client";
import { safeCallbackPath } from "../../../lib/auth/callback-path";
export const dynamic = "force-dynamic";
export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeCallbackPath(
    (await searchParams).next ?? null,
    "/dashboard/onboarding",
  );
  const {
    data: { user },
  } = await (await createDashboardAuthClient()).auth.getUser();
  if (!user?.email_confirmed_at)
    redirect("/auth/login?" + new URLSearchParams({ next }).toString());
  if (await hasDashboardSignupLegalEvidence(user.id, LEGAL_DOCUMENT_VERSION))
    redirect(next);
  return (
    <AuthShell>
      <GoogleTermsForm next={next} />
    </AuthShell>
  );
}
