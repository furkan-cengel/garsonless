import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import {
  deviceDigest,
  enrollDashboardSecurity,
  readDashboardDeviceEvidence,
  saveDashboardVerifiedSession,
  invalidateDashboardSession,
} from "@garsonless/db/server";
import {
  deviceChallengeReason,
  DEVICE_COOKIE,
  DEVICE_SESSION_SECONDS,
  type DeviceReason,
  type NetworkEvidence,
} from "./device-policy";
import { readDeviceNetwork } from "./device-network";
import { sessionIdFromToken } from "./flow-grant";
import { googleSessionProof } from "./google-session-proof";
import type { SupabaseClient, User, Session } from "@supabase/supabase-js";
type DeviceAuthClient = {
  auth: Pick<SupabaseClient["auth"], "getUser" | "getSession">;
};
export const deviceSecurityEnabled = () =>
  process.env["DASHBOARD_DEVICE_SECURITY_ENABLED"] === "true";
export type DeviceContext = {
  user: User;
  sessionId: string;
  deviceToken: string;
  deviceHash: string;
  userAgentHash: string;
  network: NetworkEvidence;
};
export async function deviceContext(
  client: DeviceAuthClient,
  createDevice = false,
): Promise<DeviceContext | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  const {
    data: { session },
  } = await client.auth.getSession();
  const sessionId = sessionIdFromToken(session?.access_token);
  if (!user?.email_confirmed_at || !sessionId) return null;
  const store = await cookies();
  let token = store.get(DEVICE_COOKIE)?.value ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    if (!createDevice) token = "";
    else {
      token = randomBytes(32).toString("hex");
      store.set(DEVICE_COOKIE, token, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        path: "/",
      });
    }
  }
  const h = await headers();
  return {
    user,
    sessionId,
    deviceToken: token,
    deviceHash: deviceDigest(token),
    userAgentHash: deviceDigest("ua:" + (h.get("user-agent") ?? "")),
    network: await readDeviceNetwork(h),
  };
}
export async function checkDeviceEvidence(
  context: DeviceContext,
): Promise<DeviceReason | null> {
  await enrollDashboardSecurity(context.user.id);
  const { session, device } = await readDashboardDeviceEvidence(
    context.user.id,
    context.sessionId,
    context.deviceHash,
  );
  const record =
    session?.device_hash === context.deviceHash && !session.revoked_at
      ? session
      : null;
  const reason =
    record && context.deviceToken
      ? deviceChallengeReason(
          {
            expiresAt: record.expires_at,
            country: record.country,
            ipHash: record.ip_hash,
            userAgentHash: record.user_agent_hash,
          },
          context.network,
          context.userAgentHash,
        )
      : "new_device";
  if (!reason) return null;
  if (session && !session.revoked_at)
    await invalidateDashboardSession(context.sessionId);
  if (context.deviceToken && device && !device.revoked_at) {
    const trustReason = deviceChallengeReason(
      {
        expiresAt: device.expires_at,
        country: device.country,
        ipHash: device.ip_hash,
        userAgentHash: device.user_agent_hash,
      },
      context.network,
      context.userAgentHash,
    );
    if (!trustReason) {
      await saveDashboardVerifiedSession({
        session_id: context.sessionId,
        user_id: context.user.id,
        device_hash: context.deviceHash,
        user_agent_hash: context.userAgentHash,
        country: context.network.country,
        ip_hash: context.network.ipHash,
        expires_at: device.expires_at,
      });
      return null;
    }
    return trustReason;
  }
  return reason;
}
/** An actual email code/link verification also satisfies this session's email step-up. */
export async function recordEmailVerifiedDeviceSession(
  client: DeviceAuthClient,
) {
  if (!deviceSecurityEnabled()) return;
  const {
    data: { session },
  } = await client.auth.getSession();
  let emailProof = false;
  try {
    const claims = JSON.parse(
      Buffer.from(
        session?.access_token.split(".")[1] ?? "",
        "base64url",
      ).toString(),
    );
    emailProof =
      Array.isArray(claims.amr) &&
      claims.amr.some((item: { method?: string }) => item.method === "otp");
  } catch {
    /* No proof. */
  }
  if (!emailProof) return;
  const ctx = await deviceContext(client, true);
  if (!ctx) throw new Error("Verified email session unavailable");
  await enrollDashboardSecurity(ctx.user.id);
  await saveDashboardVerifiedSession({
    session_id: ctx.sessionId,
    user_id: ctx.user.id,
    device_hash: ctx.deviceHash,
    user_agent_hash: ctx.userAgentHash,
    country: ctx.network.country,
    ip_hash: ctx.network.ipHash,
    expires_at: new Date(
      Date.now() + DEVICE_SESSION_SECONDS * 1000,
    ).toISOString(),
  });
}

/** Called only after the server-started Google PKCE code has been exchanged. */
export async function recordGoogleVerifiedDeviceSession(
  client: DeviceAuthClient,
  exchangedSession: Session,
): Promise<boolean> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser(exchangedSession.access_token);
  if (error || !user) return false;
  const proof = googleSessionProof(exchangedSession.access_token, user);
  if (!proof) return false;
  if (!deviceSecurityEnabled()) return true;
  const ctx = await deviceContext(client, true);
  if (!ctx || ctx.user.id !== user.id || ctx.sessionId !== proof.sessionId)
    return false;
  await enrollDashboardSecurity(user.id);
  await saveDashboardVerifiedSession({
    session_id: ctx.sessionId,
    user_id: user.id,
    device_hash: ctx.deviceHash,
    user_agent_hash: ctx.userAgentHash,
    country: ctx.network.country,
    ip_hash: ctx.network.ipHash,
    expires_at: new Date(
      proof.verifiedAt + DEVICE_SESSION_SECONDS * 1000,
    ).toISOString(),
  });
  return true;
}
