import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";

export type NetworkRisk = { available: boolean; suspicious: boolean };
const unavailable: NetworkRisk = { available: false, suspicious: false };
const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, prefix, "ipv4");
blocked.addSubnet("2001:db8::", 32, "ipv6");

/** Only globally routable addresses may leave the server. */
export function publicDeviceIp(value: string | null): string | null {
  if (!value || value.includes("%")) return null;
  const version = isIP(value);
  if (version === 4) return blocked.check(value, "ipv4") ? null : value;
  if (version !== 6 || !/^[23]/.test(value) || blocked.check(value, "ipv6"))
    return null;
  return new URL(`http://[${value}]/`).hostname.slice(1, -1);
}

/** A separate cache per adapter makes timeouts, failures and concurrency testable. */
export function createIpinfoLookup(
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<
    string,
    { expires: number; result: Promise<NetworkRisk> }
  >();
  let cooldownUntil = 0;
  return async (candidate: string, token: string): Promise<NetworkRisk> => {
    const ip = publicDeviceIp(candidate);
    if (!ip || !token.trim()) return unavailable;
    // Neither the raw IP nor token is retained as a cache key.
    const key = createHash("sha256")
      .update(token + "\0" + ip)
      .digest("hex");
    const existing = cache.get(key);
    if (existing && existing.expires > now()) return existing.result;
    if (cooldownUntil > now()) return unavailable;
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    const entry = {
      expires: now() + 5000,
      result: Promise.resolve(unavailable),
    };
    entry.result = (async (): Promise<NetworkRisk> => {
      try {
        const response = await fetcher(
          `https://api.ipinfo.io/lookup/${encodeURIComponent(ip)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(options.timeoutMs ?? 1500),
          },
        );
        if (!response.ok) {
          if ([401, 403, 429].includes(response.status))
            cooldownUntil = now() + 60_000;
          return unavailable;
        }
        const body: unknown = await response.json();
        if (!body || typeof body !== "object") return unavailable;
        const data = body as Record<string, unknown>;
        // Missing privacy fields (e.g. a Lite subscription) cannot mean safe.
        if (
          typeof data.ip !== "string" ||
          publicDeviceIp(data.ip) !== ip ||
          typeof data.is_anonymous !== "boolean" ||
          typeof data.is_hosting !== "boolean"
        )
          return unavailable;
        const result = {
          available: true,
          suspicious: data.is_anonymous || data.is_hosting,
        };
        entry.expires = now() + 5 * 60_000;
        return result;
      } catch {
        // Do not log upstream errors: they may include the IP or authorization token.
        return unavailable;
      }
    })();
    cache.set(key, entry);
    return entry.result;
  };
}
export const lookupIpinfoRisk = createIpinfoLookup();
