import Iyzipay from 'iyzipay'

export interface IyzicoClientConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export function createIyzicoClient(config: IyzicoClientConfig) {
  if (!config.apiKey || !config.secretKey) {
    throw new Error('İyzico credentials not configured')
  }
  return new Iyzipay({ apiKey: config.apiKey, secretKey: config.secretKey, uri: config.baseUrl })
}

export interface CheckoutInitResult {
  paymentPageUrl: string
  token: string
}

export function initializeCheckout(
  client: Iyzipay,
  request: Parameters<Iyzipay['checkoutFormInitialize']['create']>[0],
): Promise<CheckoutInitResult> {
  return new Promise((resolve, reject) => {
    // iyzipay SDK resource method is .create (no .initialize exists)
    client.checkoutFormInitialize.create(request, (err, result) => {
      if (err) return reject(err)
      if (result.status !== 'success' || !result.paymentPageUrl || !result.token) {
        return reject(new Error(result.errorMessage ?? 'Checkout initialization failed'))
      }
      resolve({ paymentPageUrl: result.paymentPageUrl, token: result.token })
    })
  })
}

export function retrieveCheckout(
  client: Iyzipay,
  token: string,
): Promise<{ paymentStatus: string; basketId: string }> {
  return new Promise((resolve, reject) => {
    // resource property is checkoutForm (from CheckoutForm.js), not checkoutFormRetrieve
    client.checkoutForm.retrieve({ token }, (err, result) => {
      if (err) return reject(err)
      if (result.status !== 'success') {
        return reject(new Error(result.errorMessage ?? 'Checkout retrieve failed'))
      }
      resolve({
        paymentStatus: result.paymentStatus ?? '',
        basketId: result.basketId ?? '',
      })
    })
  })
}
