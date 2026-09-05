import { createSubscriptionInvoiceDocumentReadPort } from '@garsonless/db/server'
import { createNilveraInvoiceProvider, readNilveraConfig } from '../../../../../../../../lib/accounting/nilvera-invoice-provider'
import { handleSubscriptionInvoiceDocument } from '../../../../../../../../lib/accounting/subscription-invoice-document-handler'
import { getUserRestaurantAccess } from '../../../../../../../../lib/auth/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string; invoiceId: string }> },
) {
  return handleSubscriptionInvoiceDocument(await params, {
    resolveAccess: getUserRestaurantAccess,
    readDocument: (input) => createSubscriptionInvoiceDocumentReadPort().read(input),
    downloadPdf: (document) => createNilveraInvoiceProvider(readNilveraConfig()).downloadPdf(document),
  })
}
