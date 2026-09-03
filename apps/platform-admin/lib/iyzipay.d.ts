// Minimal declarations for the finance-only iyzico refund adapter.
declare module 'iyzipay' {
  class Iyzipay {
    constructor(options: { apiKey: string; secretKey: string; uri: string })
  }
  export = Iyzipay
}
