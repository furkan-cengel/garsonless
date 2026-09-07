export const DEVICE_TRUST_SECONDS = 15 * 24 * 60 * 60;
export const DEVICE_SESSION_SECONDS = 24 * 60 * 60;
export const DEVICE_COOKIE = "masabu_trusted_device";
export type NetworkEvidence = {
  country: string | null;
  ipHash: string | null;
  suspicious: boolean;
  available: boolean;
};
export type DeviceEvidence = {
  expiresAt: string;
  country: string | null;
  ipHash: string | null;
  userAgentHash: string;
};
export type DeviceReason =
  | "new_device"
  | "expired"
  | "country_changed"
  | "suspicious_network"
  | "network_unavailable";
export function deviceChallengeReason(
  device: DeviceEvidence | null,
  network: NetworkEvidence,
  userAgentHash: string,
  now = Date.now(),
): DeviceReason | null {
  if (!device || device.userAgentHash !== userAgentHash) return "new_device";
  if (
    Date.parse(device.expiresAt) <= now ||
    !Number.isFinite(Date.parse(device.expiresAt))
  )
    return "expired";
  if (device.country && network.country && device.country !== network.country)
    return "country_changed";
  if (!network.available && device.ipHash !== network.ipHash)
    return "network_unavailable";
  if (network.suspicious && device.ipHash !== network.ipHash)
    return "suspicious_network";
  return null;
}
export const DEVICE_REASON_TEXT: Record<DeviceReason, string> = {
  new_device: "Bu tarayıcıyı doğrulayarak hesabına güvenle devam et.",
  expired: "Bu cihazın güven süresi doldu. Devam etmek için yeniden doğrula.",
  country_changed:
    "Farklı bir ülkeden bağlantı algılandı. Hesabını korumak için yeniden doğrula.",
  suspicious_network:
    "Bağlandığın ağ değişti. Hesabını korumak için yeniden doğrula.",
  network_unavailable:
    "Yeni bağlantının güvenliği doğrulanamadı. E-posta koduyla devam edebilirsin.",
};
