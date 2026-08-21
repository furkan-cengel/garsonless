import { normalizeFooterContactLinks, normalizeFooterSocialLinks } from '@garsonless/ui/menu'
import { readStoreInfo } from '@garsonless/ui/themes'

export interface FooterStoreDataAvailability {
  address: boolean
  contact: boolean
  social: boolean
}

/** Reflect only data that the public footer can actually render. */
export function resolveFooterStoreDataAvailability(settings: unknown): FooterStoreDataAvailability {
  const contact = readStoreInfo(settings)?.contact
  return {
    address: Boolean([contact?.address, contact?.district, contact?.city, contact?.zip].some((value) => value?.trim())),
    contact: normalizeFooterContactLinks(contact).length > 0,
    social: normalizeFooterSocialLinks(contact).length > 0,
  }
}
