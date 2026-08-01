import type { PaymentMethod } from '@garsonless/db/browser'

// ONE place the four payment methods get their TR label + badge palette, shared
// by the orders board, the session settlement sheet, and any future surface so a
// method always reads the same. Imported from the client-safe `order-client`
// subpath (type-only) — never pulls the server barrel into a client bundle.
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  iyzico: 'İyzico',
  cash: 'Nakit',
  pos: 'Fiziksel POS',
  comp: 'İkram',
  split: 'Hesap bölüşme',
}

export interface MethodBadge {
  label: string
  /** Badge background (explicit hex — portable across surface --var scopes). */
  bg: string
  /** Badge foreground / text colour. */
  fg: string
  /** İkram = settled but ₺0 COLLECTED (give-away). Surfaces render it distinctly. */
  isComp: boolean
}

// Explicit hex (not CSS vars) so the badge is portable across the orders board
// and the settlement sheet regardless of their local --var scope. Cash is the
// money-green of collected ciro; İyzico/POS are cool tones; İkram is a distinct
// violet that deliberately does NOT read as collected money.
export function paymentMethodBadge(method: PaymentMethod | null): MethodBadge {
  switch (method) {
    case 'cash':
      return { label: PAYMENT_METHOD_LABELS.cash, bg: '#e6f4ec', fg: '#137a4d', isComp: false }
    case 'pos':
      return { label: PAYMENT_METHOD_LABELS.pos, bg: '#e8eef6', fg: '#2c5282', isComp: false }
    case 'iyzico':
      return { label: PAYMENT_METHOD_LABELS.iyzico, bg: '#e7e9fb', fg: '#4338ca', isComp: false }
    case 'comp':
      return { label: PAYMENT_METHOD_LABELS.comp, bg: '#f3e8ff', fg: '#7c3aed', isComp: true }
    case 'split':
      return { label: PAYMENT_METHOD_LABELS.split, bg: '#fff7ed', fg: '#b45309', isComp: false }
    default:
      // paid_at set but method null = legacy-collected, unknown channel. Still
      // collected (not comp) — a neutral "Ödendi" chip, not a fabricated method.
      return { label: 'Ödendi', bg: '#eceef0', fg: '#5b5d63', isComp: false }
  }
}
