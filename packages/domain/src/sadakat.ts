export interface SadakatConfig {
  name: string;
  logoUrl: string | null;
  color: string;
  goal: number;
  reward: string;
  eligibleProducts: string;
}
export interface SadakatProgram extends SadakatConfig {
  restaurantId: string;
  slug: string;
  active: boolean;
}
export interface SadakatCard {
  joinedAt: string;
  stamps: number;
  history: {
    id: string;
    delta: number;
    direction: string;
    reason: string;
    createdAt: string;
  }[];
}
export interface SadakatDashboard {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  isOwner: boolean;
  active: boolean;
  access: { startsAt: string; endsAt: string } | null;
  program: (SadakatConfig & { goalLocked: boolean }) | null;
  initialGoal: number;
  initialReward: string;
  initialGoalLocked: boolean;
  networkScope: boolean;
  customers?: {
    id: string;
    name: string | null;
    phone: string | null;
    joinedAt: string;
    stamps: number;
    lastVisit: string | null;
    visits: number;
  }[];
  operations?: {
    id: string;
    kind: string;
    delta: number;
    reason: string;
    actorId: string;
    name: string | null;
    createdAt: string;
    reversed: boolean;
  }[];
  report?: {
    members: number;
    stampsIssued: number;
    rewardsUsed: number;
    newCustomers: number;
    returningCustomers: number;
  };
}
export interface SadakatMutation {
  id: string;
  stamps: number;
  delta: number;
  kind: "earn" | "redeem" | "reversal";
}
export function validSadakatConfig(config: SadakatConfig): boolean {
  const text = (value: unknown, max: number) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (
    !text(config.name, 120) ||
    !text(config.reward, 300) ||
    !text(config.eligibleProducts, 500) ||
    !Number.isInteger(config.goal) ||
    config.goal < 2 ||
    config.goal > 100 ||
    !/^#[a-f\d]{6}$/i.test(config.color)
  )
    return false;
  if (config.logoUrl) {
    try {
      if (
        config.logoUrl.length > 2048 ||
        new URL(config.logoUrl).protocol !== "https:"
      )
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
export function sadakatProgress(stamps: number, goal: number) {
  const balance = Math.max(0, Math.floor(stamps));
  return {
    rewards: Math.floor(balance / goal),
    progress: balance % goal,
    remaining: goal - (balance % goal),
  };
}
export const SADAKAT_ERRORS: Record<string, string> = {
  SADAKAT_FORBIDDEN: "Bu işlem için yetkin yok.",
  SADAKAT_EXPIRED:
    "Pilot erişimi şu anda aktif değil. Kart ve geçmiş korunuyor.",
  SADAKAT_GOAL_LOCKED: "İlk damgadan sonra ödül hedefi değiştirilemez.",
  SADAKAT_PROGRAM_SETTINGS:
    "Sadakat kartının hedefi ve kapsamı bağımsız ürün ayarlarından yönetilir.",
  SADAKAT_NETWORK_SCOPE:
    "Bu pilot tek işletme kartı içindir. Mevcut ağ bakiyesini değiştirmek için destekle iletişime geç.",
  SADAKAT_CODE_EXPIRED:
    "Kod bulunamadı veya süresi doldu. Müşteriden yeni kod açmasını iste.",
  SADAKAT_INSUFFICIENT: "Bu işlem için yeterli damga yok.",
  SADAKAT_ALREADY_REVERSED: "Bu işlem daha önce geri alındı.",
  SADAKAT_REASON_REQUIRED: "Geri alma gerekçesini yaz.",
  SADAKAT_PHONE_REQUIRED: "Kart oluşturmak için iletişim bilgini doğrula.",
  SADAKAT_CONTACT_REQUIRED: "Kart oluşturmak için e-postanı doğrula.",
  SADAKAT_NOT_JOINED: "Önce sadakat kartına katıl.",
  SADAKAT_NOT_FOUND: "Sadakat kartı bulunamadı.",
  SADAKAT_CONFLICT: "İşlem bilgileri değişmiş. Kartı yeniden açıp dene.",
  SADAKAT_SLUG_TAKEN: "Bu bağlantı adı kullanılıyor. Başka bir ad seç.",
  SADAKAT_INVALID: "Girilen bilgileri kontrol et.",
};

export interface SadakatStaff {
  id: string;
  email: string;
  status: "invited" | "active" | "disabled";
  permissions: readonly string[];
}
