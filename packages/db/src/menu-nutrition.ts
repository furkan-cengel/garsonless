export interface DietaryClaims {
  vegetarian: boolean
  vegan: boolean
  halal: boolean
  containsAlcohol: boolean
  containsPork: boolean
}

export function getDietaryClaimsConflict(claims: DietaryClaims): string | null {
  if (claims.vegan && !claims.vegetarian) {
    return 'Vegan olarak işaretlenen ürün vejetaryen de olmalıdır'
  }
  if (claims.halal && (claims.containsAlcohol || claims.containsPork)) {
    return 'Helal olarak işaretlenen ürün alkol veya domuz kaynaklı bileşen içeremez'
  }
  return null
}

export function calculateMarginPercent(price: number, cost: number | null): number | null {
  if (!Number.isFinite(price) || price <= 0 || cost === null || !Number.isFinite(cost) || cost < 0) {
    return null
  }
  return Math.round(((price - cost) / price) * 100)
}
