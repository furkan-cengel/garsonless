import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import {
  createIyzicoAddOnProvider,
  readIyzicoAddOnPaymentReport,
} from '../lib/billing/iyzico-add-on-provider'
import type { AddOnPurchase } from '@garsonless/application/add-on-purchases'
if (process.env.IYZICO_BILLING_BASE_URL !== 'https://sandbox-api.iyzipay.com')
  throw new Error('Sandbox only')
const id = randomUUID()
const purchase: AddOnPurchase = {
  id,
  restaurantId: randomUUID(),
  addOn: 'storefront_video_hero',
  status: 'initializing',
  netAmountMinor: 39000,
  totalAmountMinor: 46800,
  vatRate: 20,
  currency: 'TRY',
  token: null,
  paymentPageUrl: null,
  returnContext: null,
  profile: {
    legalName: 'Masabu Sandbox',
    name: 'Masabu',
    surname: 'Sandbox',
    identityNumber: '11111111111',
    email: 'sandbox-addon@example.com',
    gsmNumber: '+905350000000',
    billingAddress: {
      address: 'Sandbox test address',
      city: 'Istanbul',
      district: 'Kadikoy',
      country: 'Turkey',
      taxOffice: 'Sandbox',
    },
  },
}
const provider = createIyzicoAddOnProvider('127.0.0.1')
const complete = process.argv.includes('--complete')
const verify = process.argv.includes('--verify')
const previous =
  complete || verify
    ? JSON.parse(
        readFileSync('/private/tmp/masabu-addon-sandbox/session.json', 'utf8'),
      )
    : null
const checkout = previous?.checkout ?? (await provider.initialize(purchase))
if (verify) {
  const evidence = await provider.retrieve(checkout.token, previous.purchase.id)
  const report = await readIyzicoAddOnPaymentReport(
    evidence.paymentId,
    evidence.conversationId,
  )
  const reportPayment = (
    report.payments as Array<Record<string, unknown>>
  ).find((p) => String(p.paymentId) === evidence.paymentId)
  writeFileSync(
    '/private/tmp/masabu-addon-sandbox/evidence.json',
    JSON.stringify(evidence),
    { mode: 0o600 },
  )
  console.log(
    JSON.stringify({
      verified: true,
      providerPaymentStatus: reportPayment?.paymentStatus,
      providerRefundStatus: reportPayment?.paymentRefundStatus,
      status: evidence.status,
      amount: evidence.totalAmountMinor,
      currency: evidence.currency,
    }),
  )
  process.exit(0)
}
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(checkout.paymentPageUrl, { waitUntil: 'domcontentloaded' })
  const out = '/private/tmp/masabu-addon-sandbox'
  mkdirSync(out, { recursive: true })
  await page.screenshot({ path: `${out}/checkout.png`, fullPage: true })
  if (complete) {
    await page.locator('#ccname').fill('Masabu Sandbox')
    await page.locator('#ccnumber').fill('5528790000000008')
    await page.locator('#ccexp').fill('12/30')
    await page.locator('#cccvc').fill('123')
    await page.getByRole('button', { name: /468,00 TL ÖDE/ }).click()
    await page
      .waitForURL((url) => url.hostname === 'localhost', { timeout: 30000 })
      .catch(() => undefined)
    await page.screenshot({ path: `${out}/after-submit.png`, fullPage: true })
    console.log(
      JSON.stringify({
        afterSubmit: (await page.locator('body').innerText()).slice(0, 3500),
        url: page.url().split('?')[0],
      }),
    )
    try {
      const evidence = await provider.retrieve(
        checkout.token,
        previous.purchase.id,
      )
      writeFileSync(`${out}/evidence.json`, JSON.stringify(evidence), {
        mode: 0o600,
      })
      console.log(
        JSON.stringify({
          verified: true,
          status: evidence.status,
          amount: evidence.totalAmountMinor,
          currency: evidence.currency,
        }),
      )
    } catch (e) {
      console.log(
        JSON.stringify({
          verified: false,
          error: e instanceof Error ? e.message : 'unknown',
        }),
      )
    }
  }
  const fields = await page.locator('input').evaluateAll((els) =>
    els.map((node) => {
      const el = node as HTMLInputElement
      return {
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        type: el.type,
      }
    }),
  )
  console.log(
    JSON.stringify(
      {
        initialized: true,
        fields,
        text: (await page.locator('body').innerText()).slice(0, 4500),
      },
      null,
      2,
    ),
  )
  if (!complete)
    writeFileSync(
      `${out}/session.json`,
      JSON.stringify({ purchase, checkout }),
      { mode: 0o600 },
    )
} finally {
  await browser.close()
}
