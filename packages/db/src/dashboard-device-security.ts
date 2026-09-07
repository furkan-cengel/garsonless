import { createHmac } from "node:crypto";
import { createServiceClient } from "./service-client";
const db = () => createServiceClient();
export function deviceDigest(value: string): string {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Device security unavailable");
  return createHmac("sha256", key)
    .update("masabu-device:" + value)
    .digest("hex");
}
type DeviceRecord = {
  expires_at: string;
  country: string | null;
  ip_hash: string | null;
  user_agent_hash: string;
  device_hash?: string;
  revoked_at: string | null;
};
export async function enrollDashboardSecurity(userId: string) {
  const { error } = await db()
    .from("dashboard_security_accounts")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error("Device security unavailable");
}
export async function readDashboardDeviceEvidence(
  userId: string,
  sessionId: string,
  deviceHash: string,
) {
  const client = db();
  const [session, device] = await Promise.all([
    client
      .from("dashboard_verified_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("dashboard_trusted_devices")
      .select("*")
      .eq("token_hash", deviceHash)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (session.error || device.error)
    throw new Error("Device security unavailable");
  return {
    session: session.data as DeviceRecord | null,
    device: device.data as DeviceRecord | null,
  };
}
export async function saveDashboardVerifiedSession(input: {
  session_id: string;
  user_id: string;
  device_hash: string;
  user_agent_hash: string;
  country: string | null;
  ip_hash: string | null;
  expires_at: string;
}) {
  const { error } = await db()
    .from("dashboard_verified_sessions")
    .upsert({
      ...input,
      revoked_at: null,
      verified_at: new Date().toISOString(),
    });
  if (error) throw new Error("Device security unavailable");
}
export async function invalidateDashboardSession(sessionId: string) {
  const { error } = await db()
    .from("dashboard_verified_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (error) throw new Error("Device security unavailable");
}
export async function revokeDashboardDevices(userId: string) {
  const client = db();
  const timestamp = new Date().toISOString();
  const results = await Promise.all([
    client
      .from("dashboard_trusted_devices")
      .update({ revoked_at: timestamp })
      .eq("user_id", userId),
    client
      .from("dashboard_verified_sessions")
      .update({ revoked_at: timestamp })
      .eq("user_id", userId),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Device security unavailable");
}
export async function createDashboardDeviceChallenge(input: {
  id: string;
  user_id: string;
  session_id: string;
  device_hash: string;
  code_hash: string;
  user_agent_hash: string;
  country: string | null;
  ip_hash: string | null;
}) {
  const { error } = await db()
    .from("dashboard_device_challenges")
    .insert({
      ...input,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
  if (error) throw new Error("Device security unavailable");
}
export async function markDashboardChallengeSent(id: string) {
  const { error } = await db()
    .from("dashboard_device_challenges")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Device security unavailable");
}
export async function verifyDashboardDeviceChallenge(input: {
  p_id: string;
  p_user_id: string;
  p_session_id: string;
  p_device_hash: string;
  p_code_hash: string;
  p_user_agent_hash: string;
  p_country: string | null;
  p_ip_hash: string | null;
  p_trust: boolean;
}) {
  const client = db();
  const call = client.rpc.bind(client) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  const { data, error } = await call(
    "verify_dashboard_device_challenge",
    input,
  );
  if (error) throw new Error("Device security unavailable");
  return data as "verified" | "invalid" | "expired";
}
export async function sendDashboardDeviceCode(
  email: string,
  code: string,
  id: string,
) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) throw new Error("Device email unavailable");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": "device-" + id,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Masabu giriş doğrulama kodun",
      text: `Masabu giriş doğrulama kodun: ${code}\n\nBu kod 10 dakika geçerlidir. Kodu kimseyle paylaşma. Bu girişi sen başlatmadıysan hesabının şifresini yenile.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;color:#243126"><h1 style="font-size:24px">Girişini doğrula</h1><p>Masabu hesabına devam etmek için bu kodu gir:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>Kod 10 dakika geçerlidir. Kodu kimseyle paylaşma.</p><p>Bu girişi sen başlatmadıysan hesabının şifresini yenile.</p></div>`,
    }),
  });
  if (!result.ok) throw new Error("Device email unavailable");
}

export async function readPendingDashboardDeviceChallenge(
  id: string,
  userId: string,
  sessionId: string,
  deviceHash: string,
): Promise<{ retryAfter: number } | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const { data, error } = await db()
    .from("dashboard_device_challenges")
    .select("created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("device_hash", deviceHash)
    .gt("expires_at", new Date().toISOString())
    .not("sent_at", "is", null)
    .is("consumed_at", null)
    .lt("attempts", 5)
    .maybeSingle();
  if (error) throw new Error("Device security unavailable");
  return data
    ? {
        retryAfter: Math.max(
          0,
          Math.ceil((Date.parse(data.created_at) + 60000 - Date.now()) / 1000),
        ),
      }
    : null;
}
