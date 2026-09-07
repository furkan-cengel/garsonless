import { deviceDigest } from "@garsonless/db/server";
import { lookupIpinfoRisk } from "./device-ipinfo";
import { resolveDeviceNetwork } from "./device-network-evidence";
import type { NetworkEvidence } from "./device-policy";

export async function readDeviceNetwork(
  h: Pick<Headers, "get">,
): Promise<NetworkEvidence> {
  return resolveDeviceNetwork(h, {
    vercel: process.env["VERCEL"] === "1",
    production: process.env["NODE_ENV"] === "production",
    ipinfoEnabled: process.env["DASHBOARD_IPINFO_ENABLED"] === "true",
    token: process.env["IPINFO_TOKEN"] ?? "",
    digest: deviceDigest,
    lookup: lookupIpinfoRisk,
  });
}
