import { readPendingDashboardDeviceChallenge } from "@garsonless/db/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthShell from "../../../components/auth/AuthShell";
import DeviceVerificationForm from "../../../components/auth/DeviceVerificationForm";
import { createDashboardAuthClient } from "../../../lib/auth/auth-client";
import {
  deviceContext,
  checkDeviceEvidence,
  deviceSecurityEnabled,
} from "../../../lib/auth/device-session";
import { DEVICE_REASON_TEXT } from "../../../lib/auth/device-policy";
import { safeCallbackPath } from "../../../lib/auth/callback-path";
export const dynamic = "force-dynamic";
export default async function DeviceVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeCallbackPath((await searchParams).next ?? null);
  if (!deviceSecurityEnabled()) redirect(next);
  const client = await createDashboardAuthClient();
  const ctx = await deviceContext(client);
  if (!ctx) redirect("/auth/login?" + new URLSearchParams({ next }).toString());
  const reason = await checkDeviceEvidence(ctx);
  if (!reason) redirect(next);
  const email = ctx.user.email ?? "";
  const [local, domain] = email.split("@");
  const masked = (local?.slice(0, 2) ?? "") + "•••@" + (domain ?? "");
  const challengeId = (await cookies()).get("masabu_device_challenge")?.value;
  const pending = challengeId
    ? await readPendingDashboardDeviceChallenge(
        challengeId,
        ctx.user.id,
        ctx.sessionId,
        ctx.deviceHash,
      )
    : null;
  return (
    <AuthShell>
      <DeviceVerificationForm
        email={masked}
        next={next}
        reason={DEVICE_REASON_TEXT[reason]}
        hasCode={!!pending}
        initialRetryAfter={pending?.retryAfter ?? 0}
      />
    </AuthShell>
  );
}
