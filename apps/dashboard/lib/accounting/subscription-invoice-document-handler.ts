export type SubscriptionInvoiceDocumentHandlerDependencies = {
  resolveAccess(restaurantId: string): Promise<{ isOwner: boolean } | null>
  readDocument(input: { restaurantId: string; invoiceId: string }): Promise<
    | { ok: false; error: string }
    | { ok: true; value:
      | { status: 'not_found' }
      | { status: 'not_ready' }
      | { status: 'ready'; providerDocumentRef: string; fiscalDocumentType: 'e_fatura' | 'e_arsiv' }
    }
  >
  downloadPdf(document: { ref: string; type: 'e_fatura' | 'e_arsiv' }): Promise<Uint8Array>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

function privateMessage(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: PRIVATE_HEADERS })
}

export async function handleSubscriptionInvoiceDocument(
  params: { restaurantId: string; invoiceId: string },
  dependencies: SubscriptionInvoiceDocumentHandlerDependencies,
): Promise<Response> {
  const { restaurantId, invoiceId } = params
  if (!UUID_PATTERN.test(restaurantId) || !UUID_PATTERN.test(invoiceId)) {
    return privateMessage('Fatura bulunamadı.', 404)
  }

  try {
    // The explicit owner gate deliberately runs before any service-role lookup.
    // Members and guessed tenant/invoice identities receive the same response.
    const access = await dependencies.resolveAccess(restaurantId)
    if (!access?.isOwner) return privateMessage('Fatura bulunamadı.', 404)

    const result = await dependencies.readDocument({ restaurantId, invoiceId })
    if (!result.ok) return privateMessage('Fatura belgesi şu anda alınamıyor.', 503)
    if (result.value.status === 'not_found') return privateMessage('Fatura bulunamadı.', 404)
    if (result.value.status === 'not_ready') return privateMessage('Fatura henüz hazır değil.', 409)

    const pdf = await dependencies.downloadPdf({
      ref: result.value.providerDocumentRef,
      type: result.value.fiscalDocumentType,
    })
    const body = Uint8Array.from(pdf).buffer
    return new Response(body, {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Disposition': `attachment; filename="masabu-fatura-${invoiceId}.pdf"`,
        'Content-Length': String(pdf.byteLength),
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
        'Content-Type': 'application/pdf',
      },
    })
  } catch {
    return privateMessage('Fatura belgesi şu anda alınamıyor.', 503)
  }
}
