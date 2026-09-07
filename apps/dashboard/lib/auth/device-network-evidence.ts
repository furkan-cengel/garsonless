import { publicDeviceIp, type NetworkRisk } from "./device-ipinfo";
import type { NetworkEvidence } from "./device-policy";

export async function resolveDeviceNetwork(
  h: Pick<Headers, "get">,
  config: {
    vercel: boolean;
    production: boolean;
    ipinfoEnabled: boolean;
    token: string;
    digest: (value: string) => string;
    lookup: (ip: string, token: string) => Promise<NetworkRisk>;
  },
): Promise<NetworkEvidence> {
  // Only platform-overwritten headers are trusted. Generic forwarded headers
  // and client-provided location/VPN hints never authorize a trusted device.
  const ip = publicDeviceIp(
    config.vercel
      ? (h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? null)
      : null,
  );
  const value = config.vercel ? h.get("x-vercel-ip-country") : null;
  const country = value && /^[A-Z]{2}$/.test(value) ? value : null;
  const risk = config.ipinfoEnabled
    ? ip && config.token
      ? await config.lookup(ip, config.token)
      : { available: false, suspicious: false }
    : { available: !!country || !config.production, suspicious: false };
  return { country, ipHash: ip ? config.digest("ip:" + ip) : null, ...risk };
}
