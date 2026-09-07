import test from "node:test";
import assert from "node:assert/strict";
import { deviceChallengeReason, DEVICE_TRUST_SECONDS } from "./device-policy";
const now = Date.parse("2026-09-07T12:00:00Z");
const device = {
  expiresAt: new Date(now + DEVICE_TRUST_SECONDS * 1000).toISOString(),
  country: "TR",
  ipHash: "a",
  userAgentHash: "browser",
};
const network = {
  country: "TR",
  ipHash: "a",
  suspicious: false,
  available: true,
};
test("new browser and missing device require verification", () => {
  assert.equal(
    deviceChallengeReason(null, network, "browser", now),
    "new_device",
  );
  assert.equal(
    deviceChallengeReason(device, network, "other", now),
    "new_device",
  );
});
test("trust expires exactly at day 15 and never slides", () => {
  assert.equal(
    deviceChallengeReason(
      device,
      network,
      "browser",
      now + DEVICE_TRUST_SECONDS * 1000 - 1,
    ),
    null,
  );
  assert.equal(
    deviceChallengeReason(
      device,
      network,
      "browser",
      now + DEVICE_TRUST_SECONDS * 1000,
    ),
    "expired",
  );
  assert.equal(
    deviceChallengeReason(
      { ...device, expiresAt: "bad" },
      network,
      "browser",
      now,
    ),
    "expired",
  );
});
test("ordinary mobile IP change preserves trust; country change challenges", () => {
  assert.equal(
    deviceChallengeReason(device, { ...network, ipHash: "b" }, "browser", now),
    null,
  );
  assert.equal(
    deviceChallengeReason(
      device,
      { ...network, country: "DE" },
      "browser",
      now,
    ),
    "country_changed",
  );
});
test("suspicious changed network challenges, approved same network does not loop", () => {
  assert.equal(
    deviceChallengeReason(
      device,
      { ...network, ipHash: "vpn", suspicious: true },
      "browser",
      now,
    ),
    "suspicious_network",
  );
  assert.equal(
    deviceChallengeReason(
      device,
      { ...network, suspicious: true },
      "browser",
      now,
    ),
    null,
  );
});
test("unknown risk on a changed network is conservative", () => {
  assert.equal(
    deviceChallengeReason(
      device,
      { ...network, ipHash: "b", available: false },
      "browser",
      now,
    ),
    "network_unavailable",
  );
});
