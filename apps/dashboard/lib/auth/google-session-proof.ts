import type { User } from "@supabase/supabase-js";

/** Inspect only an access token already validated by Supabase Auth. */
export function googleSessionProof(
  validatedAccessToken: string,
  verifiedUser: Pick<User, "id" | "email_confirmed_at" | "identities">,
  now = Date.now(),
): { sessionId: string; verifiedAt: number } | null {
  if (
    !verifiedUser.email_confirmed_at ||
    !verifiedUser.identities?.some((identity) => identity.provider === "google")
  )
    return null;
  try {
    const claims = JSON.parse(
      Buffer.from(
        validatedAccessToken.split(".")[1] ?? "",
        "base64url",
      ).toString(),
    );
    if (
      claims.sub !== verifiedUser.id ||
      typeof claims.session_id !== "string" ||
      !claims.session_id ||
      typeof claims.exp !== "number" ||
      claims.exp * 1000 <= now ||
      !Array.isArray(claims.amr)
    )
      return null;
    const methods = claims.amr.filter(
      (item: unknown): item is { method: string; timestamp: number } =>
        !!item &&
        typeof item === "object" &&
        "method" in item &&
        typeof item.method === "string" &&
        "timestamp" in item &&
        typeof item.timestamp === "number" &&
        Number.isFinite(item.timestamp),
    );
    const oauth = methods.find(
      (item: { method: string }) => item.method === "oauth",
    );
    if (
      !oauth ||
      oauth.timestamp * 1000 > now + 60_000 ||
      now - oauth.timestamp * 1000 > 10 * 60_000
    )
      return null;
    // A Google identity attached to a password/recovery session is not OAuth proof.
    if (
      methods.some(
        (item: { method: string; timestamp: number }) =>
          ["password", "otp", "recovery", "invite"].includes(item.method) &&
          item.timestamp >= oauth.timestamp,
      )
    )
      return null;
    return { sessionId: claims.session_id, verifiedAt: oauth.timestamp * 1000 };
  } catch {
    return null;
  }
}
