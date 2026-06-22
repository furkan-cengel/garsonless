declare module 'iyzipay' {
  interface IyzipayOptions {
    apiKey: string
    secretKey: string
    uri: string
  }

  interface Buyer {
    id: string
    name: string
    surname: string
    email: string
    identityNumber: string
    registrationAddress: string
    city: string
    country: string
    ip: string
  }

  interface Address {
    contactName: string
    city: string
    country: string
    address: string
  }

  interface BasketItem {
    id: string
    name: string
    category1: string
    itemType: 'PHYSICAL' | 'VIRTUAL'
    price: string
  }

  interface CheckoutFormInitializeRequest {
    locale?: string
    conversationId?: string
    price: string
    paidPrice: string
    currency: string
    basketId: string
    paymentGroup: string
    callbackUrl: string
    buyer: Buyer
    shippingAddress: Address
    billingAddress: Address
    basketItems: BasketItem[]
  }

  interface CheckoutFormInitializeResult {
    status: string
    errorCode?: string
    errorMessage?: string
    paymentPageUrl?: string
    token?: string
    checkoutFormContent?: string
  }

  interface CheckoutFormRetrieveRequest {
    token: string
    locale?: string
    conversationId?: string
  }

  interface CheckoutFormRetrieveResult {
    status: string
    errorCode?: string
    errorMessage?: string
    paymentStatus?: string
    price?: string
    paidPrice?: string
    currency?: string
    basketId?: string
    conversationId?: string
  }

  // Resource names mirror the SDK's auto-loaded lib/resources/*.js files:
  // CheckoutFormInitialize.js → checkoutFormInitialize.create
  // CheckoutForm.js → checkoutForm.retrieve
  class Iyzipay {
    constructor(options: IyzipayOptions)
    checkoutFormInitialize: {
      create(
        request: CheckoutFormInitializeRequest,
        callback: (err: Error | null, result: CheckoutFormInitializeResult) => void,
      ): void
    }
    checkoutForm: {
      retrieve(
        request: CheckoutFormRetrieveRequest,
        callback: (err: Error | null, result: CheckoutFormRetrieveResult) => void,
      ): void
    }
  }

  export = Iyzipay
}
