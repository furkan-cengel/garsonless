import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_DOCUMENT_VERSION } from "@garsonless/domain/legal";
import {
  recordSignupLegalEvidence,
  hasDashboardSignupLegalEvidence,
  completeDashboardSignupEmailVerification,
} from "@garsonless/db/server";
import { createDashboardAuthClient } from "../../../../lib/auth/auth-client";
import {
  getFlowGrant,
  deleteFlowGrant,
} from "../../../../lib/auth/flow-session";
import { safeCallbackPath } from "../../../../lib/auth/callback-path";
import { recordGoogleVerifiedDeviceSession } from "../../../../lib/auth/device-session";
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const grant = await getFlowGrant("oauth");
  const next = safeCallbackPath(grant?.sessionId ?? null);
  const failure = () =>
    NextResponse.redirect(
      origin +
        "/auth/login?" +
        new URLSearchParams({ error: "auth_callback_failed", next }).toString(),
    );
  const code = request.nextUrl.searchParams.get("code");
  // Callback is only valid for a server-started Google PKCE flow in this browser.
  if (!grant || !code) return failure();
  const client = await createDashboardAuthClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email_confirmed_at || !data.session)
    return failure();
  if (!data.user.identities?.some((identity) => identity.provider === "google"))
    return failure();
  if (
    data.user.app_metadata?.["dashboard_signup_email_verification_required"] ===
    true
  ) {
    if (
      !(await completeDashboardSignupEmailVerification(data.user.id)).ok ||
      (await client.auth.refreshSession()).error
    )
      return failure();
  }
  // A fresh Google login satisfies this session's device verification.
  // Account metadata or a previously linked Google identity is not enough.
  if (!(await recordGoogleVerifiedDeviceSession(client, data.session)))
    return failure();
  if (
    grant.userId === LEGAL_DOCUMENT_VERSION &&
    !(await hasDashboardSignupLegalEvidence(
      data.user.id,
      LEGAL_DOCUMENT_VERSION,
    ))
  ) {
    const result = await recordSignupLegalEvidence({
      userId: data.user.id,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      occurredAt: new Date(grant.expiresAt - 600000).toISOString(),
      ipHash: null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    if (!result.ok)
      return NextResponse.redirect(
        origin + "/auth/terms?" + new URLSearchParams({ next }).toString(),
      );
  }
  await deleteFlowGrant("oauth");
  const target = (await hasDashboardSignupLegalEvidence(
    data.user.id,
    LEGAL_DOCUMENT_VERSION,
  ))
    ? next
    : "/auth/terms?" + new URLSearchParams({ next }).toString();
  const response = NextResponse.redirect(origin + target);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
