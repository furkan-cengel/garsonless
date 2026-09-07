import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import { googleSessionProof } from "./google-session-proof";
const now = Date.parse("2026-09-07T14:00:00Z");
const user = {
  id: "user",
  email_confirmed_at: "2026-09-07",
  identities: [{ provider: "google" }],
} as User;
const base = {
  sub: "user",
  session_id: "session",
  exp: now / 1000 + 3600,
  amr: [{ method: "oauth", timestamp: now / 1000 }],
};
const token = (extra = {}) =>
  "header." +
  Buffer.from(JSON.stringify({ ...base, ...extra })).toString("base64url") +
  ".signature";
test("fresh Google OAuth proof identifies the current verified session", () => {
  assert.deepEqual(googleSessionProof(token(), user, now), {
    sessionId: "session",
    verifiedAt: now,
  });
});
test("Google-linked password, email OTP and recovery sessions cannot skip device OTP", () => {
  for (const method of ["password", "otp", "recovery", "invite"]) {
    assert.equal(
      googleSessionProof(
        token({ amr: [{ method, timestamp: now / 1000 }] }),
        user,
        now,
      ),
      null,
    );
    assert.equal(
      googleSessionProof(
        token({ amr: [...base.amr, { method, timestamp: now / 1000 }] }),
        user,
        now,
      ),
      null,
    );
  }
});
test("other providers and unconfirmed Google accounts are rejected", () => {
  assert.equal(
    googleSessionProof(
      token(),
      { ...user, identities: [{ provider: "github" }] as User["identities"] },
      now,
    ),
    null,
  );
  assert.equal(
    googleSessionProof(
      token(),
      { ...user, email_confirmed_at: undefined },
      now,
    ),
    null,
  );
});
test("user/session binding and expired tokens are enforced", () => {
  for (const extra of [
    { sub: "other" },
    { session_id: "" },
    { session_id: null },
    { exp: now / 1000 },
    { exp: "later" },
  ])
    assert.equal(googleSessionProof(token(extra), user, now), null);
});
test("stale or future OAuth proof cannot renew device verification", () => {
  for (const timestamp of [now / 1000 - 601, now / 1000 + 61])
    assert.equal(
      googleSessionProof(
        token({ amr: [{ method: "oauth", timestamp }] }),
        user,
        now,
      ),
      null,
    );
});
test("malformed proof fails closed; Google MFA does not invalidate OAuth", () => {
  for (const jwt of [
    "",
    "broken",
    token({ amr: null }),
    token({ amr: [null, { method: "oauth", timestamp: "bad" }] }),
  ])
    assert.equal(googleSessionProof(jwt, user, now), null);
  assert.ok(
    googleSessionProof(
      token({
        amr: [...base.amr, { method: "totp", timestamp: now / 1000 + 1 }],
      }),
      user,
      now,
    ),
  );
});
