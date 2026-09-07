"use server";
import { randomInt, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  consumeDashboardAuthRateLimit,
  deviceDigest,
  createDashboardDeviceChallenge,
  markDashboardChallengeSent,
  verifyDashboardDeviceChallenge,
  sendDashboardDeviceCode,
  enrollDashboardSecurity,
  revokeDashboardDevices,
} from "@garsonless/db/server";
import { createDashboardAuthClient } from "../auth/auth-client";
import {
  checkDeviceEvidence,
  deviceContext,
  deviceSecurityEnabled,
} from "../auth/device-session";
import { DEVICE_COOKIE, DEVICE_TRUST_SECONDS } from "../auth/device-policy";
import { allowedAuthOrigin } from "../auth/action-origin";
import { emailCodeSchema } from "../auth/password-policy";
import { safeCallbackPath } from "../auth/callback-path";
import type { AuthActionState } from "../auth/entry-context";
const CHALLENGE_COOKIE = "masabu_device_challenge";
async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const expected = process.env["NEXT_PUBLIC_APP_URL"];
  return !!allowedAuthOrigin(
    origin,
    expected,
    process.env["NODE_ENV"] === "production",
  );
}
async function verifiedContext() {
  if (!deviceSecurityEnabled() || !(await sameOrigin())) return null;
  return deviceContext(await createDashboardAuthClient(), true);
}
export async function sendDeviceCode(
  _previous: unknown,
  _data: FormData,
): Promise<AuthActionState> {
  const ctx = await verifiedContext();
  if (!ctx?.user.email)
    return { error: "Oturumun sona erdi. Tekrar giriş yap.", code: "EXPIRED" };
  await enrollDashboardSecurity(ctx.user.id);
  const rate = await consumeDashboardAuthRateLimit({
    action: "device-code-send",
    subject: ctx.user.id,
    limit: 1,
    windowSeconds: 60,
  });
  if (!rate.ok)
    return {
      error: "Doğrulama hizmeti şu anda kullanılamıyor.",
      code: "UNAVAILABLE",
    };
  if (!rate.allowed)
    return {
      error: "Yeni kod istemeden önce biraz bekle.",
      retryAfter: 60,
      code: "RATE_LIMITED",
    };
  const hourly = await consumeDashboardAuthRateLimit({
    action: "device-code-send-hour",
    subject: ctx.user.id,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!hourly.ok || !hourly.allowed)
    return {
      error: "Gönderim sınırına ulaşıldı. Daha sonra tekrar dene.",
      retryAfter: 3600,
      code: "RATE_LIMITED",
    };
  const id = randomUUID();
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  try {
    await createDashboardDeviceChallenge({
      id,
      user_id: ctx.user.id,
      session_id: ctx.sessionId,
      device_hash: ctx.deviceHash,
      code_hash: deviceDigest(id + ":" + code),
      user_agent_hash: ctx.userAgentHash,
      country: ctx.network.country,
      ip_hash: ctx.network.ipHash,
    });
    await sendDashboardDeviceCode(ctx.user.email, code, id);
    await markDashboardChallengeSent(id);
    (await cookies()).set(CHALLENGE_COOKIE, id, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/auth",
      maxAge: 600,
    });
    return { success: true, retryAfter: 60 };
  } catch {
    return {
      error: "Kod gönderilemedi. Biraz sonra yeniden deneyebilirsin.",
      code: "UNAVAILABLE",
    };
  }
}
export async function verifyDeviceCode(
  _previous: unknown,
  data: FormData,
): Promise<AuthActionState> {
  const parsed = emailCodeSchema.safeParse(data.get("code"));
  if (!parsed.success)
    return {
      error: "E-postandaki 6 haneli kodu gir.",
      fieldErrors: { code: "6 haneli kod gerekli." },
      code: "INVALID",
    };
  const ctx = await verifiedContext();
  const store = await cookies();
  const id = store.get(CHALLENGE_COOKIE)?.value;
  if (!ctx || !id || !/^[a-f0-9-]{36}$/.test(id))
    return { error: "Önce yeni bir doğrulama kodu iste.", code: "EXPIRED" };
  const rate = await consumeDashboardAuthRateLimit({
    action: "device-code-verify",
    subject: ctx.user.id,
    limit: 15,
    windowSeconds: 900,
  });
  if (!rate.ok || !rate.allowed)
    return {
      error: "Çok fazla deneme yapıldı. Daha sonra tekrar dene.",
      code: "RATE_LIMITED",
    };
  const trust = data.get("trustDevice") === "on";
  const result = await verifyDashboardDeviceChallenge({
    p_id: id,
    p_user_id: ctx.user.id,
    p_session_id: ctx.sessionId,
    p_device_hash: ctx.deviceHash,
    p_code_hash: deviceDigest(id + ":" + parsed.data),
    p_user_agent_hash: ctx.userAgentHash,
    p_country: ctx.network.country,
    p_ip_hash: ctx.network.ipHash,
    p_trust: trust,
  });
  if (result !== "verified")
    return {
      error:
        result === "expired"
          ? "Kodun süresi doldu veya deneme hakkın bitti. Yeni kod iste."
          : "Kod doğrulanamadı. Kodu kontrol et; ağın değiştiyse yeni kod iste.",
      fieldErrors: { code: "Kod doğrulanamadı." },
      code: result === "expired" ? "EXPIRED" : "INVALID",
    };
  store.set(DEVICE_COOKIE, ctx.deviceToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    ...(trust ? { maxAge: DEVICE_TRUST_SECONDS } : {}),
  });
  store.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 0,
  });
  redirect(safeCallbackPath(data.get("next") as string | null));
}
export async function forgetTrustedDevices(
  _previous: unknown,
  _data: FormData,
): Promise<AuthActionState> {
  if (!(await sameOrigin())) return { error: "İstek doğrulanamadı." };
  const client = await createDashboardAuthClient();
  const ctx = await deviceContext(client);
  if (!ctx || (await checkDeviceEvidence(ctx)))
    return { error: "Önce bu cihazı doğrula." };
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Tekrar giriş yap." };
  await revokeDashboardDevices(user.id);
  (await cookies()).set(DEVICE_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  redirect("/auth/device-verification");
}
