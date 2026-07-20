import type { LoyaltyReport } from '../../lib/queries/analytics'

const REDEMPTION_REASON_LABELS: Record<string, string> = {
  redeem: 'Puan / damga kullanımı',
}

export function resolveLoyaltyReasonLabel(reason: string): string {
  return REDEMPTION_REASON_LABELS[reason] ?? reason
}

export function projectLoyaltyReport(loyalty: LoyaltyReport) {
  const hasActivity =
    loyalty.pointsIssued > 0 || loyalty.pointsRedeemed > 0 || loyalty.pointsRefunded > 0 ||
    loyalty.stampsIssued > 0 || loyalty.stampsRedeemed > 0 || loyalty.stampsRefunded > 0 ||
    loyalty.visits > 0 || loyalty.welcomeCount > 0 || loyalty.comp.count > 0

  return {
    hasActivity,
    compDelta: loyalty.comp.count > 0
      ? `${loyalty.comp.count} adet · tahsilat dışı`
      : 'tahsilat dışı',
    stampRows: [
      { label: 'Kazanılan', value: loyalty.stampsIssued },
      { label: 'Kullanılan', value: loyalty.stampsRedeemed },
      { label: 'İade', value: loyalty.stampsRefunded },
    ],
    welcomeRows: [
      { label: 'Üye', value: loyalty.welcomeCount },
      { label: 'Puan', value: loyalty.welcomePoints },
    ],
    refundRows: [
      { label: 'Puan iadesi', value: loyalty.pointsRefunded },
      { label: 'Damga iadesi', value: loyalty.stampsRefunded },
    ],
  }
}
