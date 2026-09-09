"use server";
import { completeSignupAnalytics } from "../auth/signup-analytics";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LEGAL_DOCUMENT_VERSION } from "@garsonless/domain/legal";
import {
  consumeDashboardAuthRateLimit,
  recordSignupLegalEvidence,
  hasDashboardSignupLegalEvidence,
} from "@garsonless/db/server";
import { createDashboardAuthClient } from "../auth/auth-client";
import { safeCallbackPath } from "../auth/callback-path";
import { allowedAuthOrigin } from "../auth/action-origin";
import { saveFlowGrant } from "../auth/flow-session";
import type { AuthActionState } from "../auth/entry-context";
export async function signInWithGoogle(
  _previous: unknown,
  data: FormData,
): Promise<AuthActionState> {
  const h = await headers();
  const origin = allowedAuthOrigin(
    h.get("origin"),
    process.env["NEXT_PUBLIC_APP_URL"],
    process.env["NODE_ENV"] === "production",
  );
  if (!origin) return { error: "İstek doğrulanamadı." };
  const signup = data.get("signup") === "true";
  const accepted =
    data.get("termsAccepted") === "on" &&
    data.get("termsVersion") === LEGAL_DOCUMENT_VERSION;
  if (signup && !accepted)
    return {
      error: "Devam etmek için hizmet sözleşmesini kabul et.",
      fieldErrors: { termsAccepted: "Hizmet sözleşmesini kabul et." },
      code: "INVALID",
    };
  const subject =
    h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "unknown";
  const rate = await consumeDashboardAuthRateLimit({
    action: "google-start",
    subject,
    limit: 15,
    windowSeconds: 900,
  });
  if (!rate.ok || !rate.allowed)
    return {
      error:
        "Google ile giriş şu anda başlatılamıyor. Biraz sonra tekrar dene.",
    };
  try {
    const response = await fetch(
      process.env["NEXT_PUBLIC_SUPABASE_URL"] + "/auth/v1/settings",
      {
        headers: { apikey: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    const config = (await response.json()) as {
      external?: { google?: boolean };
    };
    if (!response.ok || config.external?.google !== true)
      return {
        error:
          "Google ile giriş henüz etkinleştirilmedi. E-posta ile devam edebilirsin.",
        code: "UNAVAILABLE",
      };
  } catch {
    return {
      error: "Google giriş hizmetine ulaşılamadı. Tekrar deneyebilirsin.",
      code: "UNAVAILABLE",
    };
  }
  const next = safeCallbackPath(
    data.get("next") as string | null,
    signup ? "/dashboard/onboarding" : "/dashboard",
  );
  const client = await createDashboardAuthClient();
  const result = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL(
        "/auth/google/callback?" + new URLSearchParams({ next }).toString(),
        origin,
      ).toString(),
      queryParams: { prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (result.error || !result.data.url)
    return { error: "Google ile giriş başlatılamadı. Tekrar deneyebilirsin." };
  // Signed cookie is bound to this PKCE browser flow. URL params never prove consent.
  await saveFlowGrant("oauth", accepted ? LEGAL_DOCUMENT_VERSION : "", next);
  redirect(result.data.url);
}
export async function acceptGoogleSignupTerms(
  _previous: unknown,
  data: FormData,
): Promise<AuthActionState> {
  const h = await headers();
  const origin = allowedAuthOrigin(
    h.get("origin"),
    process.env["NEXT_PUBLIC_APP_URL"],
    process.env["NODE_ENV"] === "production",
  );
  if (!origin) return { error: "İstek doğrulanamadı." };
  if (
    data.get("termsAccepted") !== "on" ||
    data.get("termsVersion") !== LEGAL_DOCUMENT_VERSION
  )
    return {
      error: "Devam etmek için hizmet sözleşmesini kabul et.",
      fieldErrors: { termsAccepted: "Hizmet sözleşmesini kabul et." },
    };
  const client = await createDashboardAuthClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email_confirmed_at)
    return { error: "Önce giriş yapıp e-postanı doğrula." };
  if (
    !(await hasDashboardSignupLegalEvidence(user.id, LEGAL_DOCUMENT_VERSION))
  ) {
    const result = await recordSignupLegalEvidence({
      userId: user.id,
      documentVersion: LEGAL_DOCUMENT_VERSION,
      occurredAt: new Date().toISOString(),
      ipHash: null,
      userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    });
    if (!result.ok)
      return { error: "Kabul kaydedilemedi. Tekrar deneyebilirsin." };
  }
  await completeSignupAnalytics(user.id);
  redirect(
    safeCallbackPath(
      data.get("next") as string | null,
      "/dashboard/onboarding",
    ),
  );
}
