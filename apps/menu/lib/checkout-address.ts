interface CheckoutAddress {
  contactName: string
  city: string
  country: string
  address: string
}

interface CheckoutAddressBundle {
  city: string
  registrationAddress: string
  shippingAddress: CheckoutAddress
  billingAddress: CheckoutAddress
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function buildCheckoutAddresses(settings: unknown, buyerFullName: string): CheckoutAddressBundle {
  const root = isRecord(settings) ? settings : {}
  const contact = isRecord(root['contact']) ? root['contact'] : {}
  const tax = isRecord(root['tax']) ? root['tax'] : {}

  const city = text(contact['city']) ?? 'Istanbul'
  const address = [
    text(tax['address']) ?? text(contact['address']),
    text(contact['district']),
    text(contact['zip']),
  ].filter((part): part is string => Boolean(part)).join(', ') || 'N/A'
  const billingName = text(tax['company']) ?? buyerFullName

  return {
    city,
    registrationAddress: address,
    shippingAddress: { contactName: buyerFullName, city, country: 'Turkey', address },
    billingAddress: { contactName: billingName, city, country: 'Turkey', address },
  }
}
