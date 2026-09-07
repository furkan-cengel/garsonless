import test from "node:test";
import assert from "node:assert/strict";
import { createIpinfoLookup, publicDeviceIp } from "./device-ipinfo";
import { resolveDeviceNetwork } from "./device-network-evidence";
import { deviceChallengeReason } from "./device-policy";
const ip = "8.8.8.8";
const response = (extra = {}) =>
  Response.json({ ip, is_anonymous: false, is_hosting: false, ...extra });
const unavailable = { available: false, suspicious: false };

test("only public IP literals are sent; IPv6 is canonicalized", () => {
  for (const input of [
    "127.0.0.1",
    "10.1.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "224.0.0.1",
    "198.51.100.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "example.com",
    "8.8.8.8/other",
    "8.8.8.8, 1.1.1.1",
  ])
    assert.equal(publicDeviceIp(input), null, input);
  assert.equal(publicDeviceIp(ip), ip);
  assert.equal(
    publicDeviceIp("2001:4860:4860:0:0:0:0:8888"),
    "2001:4860:4860::8888",
  );
});

test("authenticated HTTPS lookup shares requests, caches only briefly, and refreshes", async () => {
  let time = 0,
    calls = 0;
  const lookup = createIpinfoLookup({
    now: () => time,
    fetcher: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.ipinfo.io/lookup/8.8.8.8");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-only-token",
      );
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      return response();
    },
  });
  assert.deepEqual(
    await Promise.all([
      lookup(ip, "test-only-token"),
      lookup(ip, "test-only-token"),
    ]),
    [
      { available: true, suspicious: false },
      { available: true, suspicious: false },
    ],
  );
  assert.equal(calls, 1);
  time = 300001;
  await lookup(ip, "test-only-token");
  assert.equal(calls, 2);
  await lookup(ip, "");
  await lookup("127.0.0.1", "test-only-token");
  assert.equal(calls, 2);
});

test("VPN/proxy/Tor/relay aggregate and hosting require a code on changed IP only", async () => {
  const device = {
    expiresAt: "2027-01-01",
    country: "TR",
    ipHash: "old",
    userAgentHash: "ua",
  };
  for (const flags of [{ is_anonymous: true }, { is_hosting: true }]) {
    const lookup = createIpinfoLookup({ fetcher: async () => response(flags) });
    const risk = await lookup(ip, "test-only-token");
    const network = { ...risk, country: "TR", ipHash: "new" };
    assert.equal(
      deviceChallengeReason(device, network, "ua", 0),
      "suspicious_network",
    );
    assert.equal(
      deviceChallengeReason({ ...device, ipHash: "new" }, network, "ua", 0),
      null,
    );
  }
});

test("missing fields, malformed JSON, different IP and server failures never mean safe", async () => {
  for (const make of [
    () => Response.json({ ip }),
    () => Response.json({ ip, is_anonymous: "false", is_hosting: false }),
    () => response({ ip: "1.1.1.1" }),
    () => new Response("oops"),
    () => new Response("", { status: 503 }),
    () => {
      throw new Error("secret upstream error");
    },
  ]) {
    const lookup = createIpinfoLookup({ fetcher: async () => make() });
    assert.deepEqual(await lookup(ip, "test-only-token"), unavailable);
  }
});

test("rate limits and rejected credentials back off across IP addresses", async () => {
  for (const status of [401, 403, 429]) {
    let now = 0,
      calls = 0;
    const lookup = createIpinfoLookup({
      now: () => now,
      fetcher: async () => {
        calls++;
        return new Response("", { status });
      },
    });
    await lookup(ip, "test-only-token");
    await lookup("1.1.1.1", "test-only-token");
    assert.equal(calls, 1);
    now = 60001;
    await lookup(ip, "test-only-token");
    assert.equal(calls, 2);
  }
});

test("a slow provider aborts instead of holding login open", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const lookup = createIpinfoLookup({
      timeoutMs: 10,
      fetcher: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    });
    assert.deepEqual(await lookup(ip, "test-only-token"), unavailable);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("only trusted Vercel IP reaches provider, never email, cookies or generic forwarded IP", async () => {
  const calls: string[][] = [];
  const config = {
    vercel: true,
    production: true,
    ipinfoEnabled: true,
    token: "test-only-token",
    digest: (s: string) => "hashed:" + s,
    lookup: async (...args: [string, string]) => {
      calls.push(args);
      return { available: true, suspicious: false };
    },
  };
  const headers = new Headers({
    "x-vercel-forwarded-for": ip,
    "x-vercel-ip-country": "TR",
    "x-forwarded-for": "1.1.1.1",
    cookie: "private",
    email: "private@example.test",
  });
  const network = await resolveDeviceNetwork(headers, config);
  assert.deepEqual(calls, [[ip, "test-only-token"]]);
  assert.deepEqual(network, {
    country: "TR",
    ipHash: "hashed:ip:" + ip,
    suspicious: false,
    available: true,
  });
  await resolveDeviceNetwork(headers, { ...config, vercel: false });
  await resolveDeviceNetwork(headers, { ...config, ipinfoEnabled: false });
  const missing = await resolveDeviceNetwork(headers, { ...config, token: "" });
  assert.equal(calls.length, 1);
  assert.equal(missing.available, false);
});

test("outage on changed IP requires OTP; unchanged verified network continues", async () => {
  const network = await resolveDeviceNetwork(
    new Headers({ "x-vercel-forwarded-for": ip, "x-vercel-ip-country": "TR" }),
    {
      vercel: true,
      production: true,
      ipinfoEnabled: true,
      token: "test-only-token",
      digest: (s) => s,
      lookup: async () => unavailable,
    },
  );
  const device = {
    expiresAt: "2027-01-01",
    country: "TR",
    ipHash: "old",
    userAgentHash: "ua",
  };
  assert.equal(
    deviceChallengeReason(device, network, "ua", 0),
    "network_unavailable",
  );
  assert.equal(
    deviceChallengeReason(
      { ...device, ipHash: network.ipHash },
      network,
      "ua",
      0,
    ),
    null,
  );
});
