// Minimal iyzipay declarations for the dashboard (no official types).
// Only the surface used by the credentials test action.
declare module 'iyzipay' {
  interface IyzipayOptions {
    apiKey: string
    secretKey: string
    uri: string
  }

  interface ApiTestResult {
    status: string
    errorCode?: string
    errorMessage?: string
  }

  interface RefundV2Result {
    status?: string
    errorCode?: string
    errorMessage?: string
    conversationId?: string
    paymentId?: string
    price?: string | number
    currency?: string
    refundHostReference?: string
    signature?: string
  }

  type IyzipayCallback = (err: Error | null, result: Record<string, unknown>) => void

  class Iyzipay {
    constructor(options: IyzipayOptions)
    checkoutFormInitialize: { create(request: Record<string, unknown>, callback: IyzipayCallback): void }
    checkoutForm: { retrieve(request: Record<string, unknown>, callback: IyzipayCallback): void }
    apiTest: {
      retrieve(
        request: Record<string, never>,
        callback: (err: Error | null, result: ApiTestResult) => void,
      ): void
    }
    refundV2: {
      create(
        request: {
          locale: 'tr' | 'en'
          conversationId: string
          paymentId: string
          price: string
          currency: 'TRY'
        },
        callback: (err: Error | null, result: RefundV2Result) => void,
      ): void
    }
    subscriptionCustomer: {
      create(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
    subscriptionProduct: {
      create(request: Record<string, unknown>, callback: IyzipayCallback): void
      retrieveList(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
    subscriptionPricingPlan: {
      create(request: Record<string, unknown>, callback: IyzipayCallback): void
      retrieve(request: Record<string, unknown>, callback: IyzipayCallback): void
      retrieveList(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
    subscriptionCheckoutForm: {
      initialize(request: Record<string, unknown>, callback: IyzipayCallback): void
      retrieve(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
    subscriptionPayment: {
      retry(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
    subscription: {
      cancel(request: Record<string, unknown>, callback: IyzipayCallback): void
      search(request: Record<string, unknown>, callback: IyzipayCallback): void
    }
  }

  export = Iyzipay
}
