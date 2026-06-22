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

  class Iyzipay {
    constructor(options: IyzipayOptions)
    apiTest: {
      retrieve(
        request: Record<string, never>,
        callback: (err: Error | null, result: ApiTestResult) => void,
      ): void
    }
  }

  export = Iyzipay
}
