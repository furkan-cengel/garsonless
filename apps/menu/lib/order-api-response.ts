interface OrderBreakdown {
  subtotal: number
  pointsDiscountAmount: number
  finalTotal: number
  pointsRedeemed: number
  clamped: boolean
}

export interface OrderApiResponse {
  success: boolean
  data?: { orderId: string; breakdown: OrderBreakdown }
  error?: string
}

export async function readOrderApiResponse(response: Response): Promise<OrderApiResponse> {
  try {
    return await response.json() as OrderApiResponse
  } catch {
    return {
      success: false,
      error: response.ok
        ? 'Sunucudan geçersiz bir yanıt alındı. Lütfen tekrar deneyin.'
        : 'Sipariş şu anda işlenemiyor. Lütfen tekrar deneyin.',
    }
  }
}
