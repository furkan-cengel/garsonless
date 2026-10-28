import type { FiscalBasket, FiscalSection } from '@garsonless/application/fiscal'

type Fetch = typeof fetch
type Json = Record<string, unknown>

const REQUEST_TIMEOUT_MS = 15_000
/** Refresh a little before TokenX's 24-hour token runs out. */
const TOKEN_SAFETY_MS = 5 * 60_000

export type TokenxConfig = {
  authUrl: string
  basketUrl: string
  clientSettingsUrl: string
  clientId: string
  clientSecret: string
}

/** Retryable errors are worth another attempt later; the rest need a person (setup, data). */
export class TokenxError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(`TokenX ${code}`)
    this.name = 'TokenxError'
  }
}

// TokenX status codes that mean the request itself is wrong; retrying will not help.
const PERMANENT_CODES = new Set([6, 7, 11, 13, 1006, 1013, 1102, 1103, 1104, 1105, 1106])

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin + url.pathname.replace(/\/$/, '') : null
  } catch {
    return null
  }
}

/** Null until every TokenX variable is set; the integration stays off without them. */
export function readTokenxConfig(env: NodeJS.ProcessEnv = process.env): TokenxConfig | null {
  const authUrl = httpsUrl(env['TOKENX_AUTH_URL'])
  const basketUrl = httpsUrl(env['TOKENX_BASKET_URL'])
  const clientSettingsUrl = httpsUrl(env['TOKENX_CLIENT_SETTINGS_URL'])
  const clientId = env['TOKENX_CLIENT_ID']?.trim()
  const clientSecret = env['TOKENX_CLIENT_SECRET']?.trim()
  return authUrl && basketUrl && clientSettingsUrl && clientId && clientSecret
    ? { authUrl, basketUrl, clientSettingsUrl, clientId, clientSecret }
    : null
}

export type TokenxBasketMeta = { title: string; filter: string | null; checkNumber: string | null; note: string | null }

export function createTokenxClient(config: TokenxConfig, fetcher: Fetch = fetch, now: () => number = Date.now) {
  let token: { value: string; expiresAt: number } | null = null

  async function call(url: string, init: RequestInit): Promise<Json> {
    let response: Response
    try {
      response = await fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: 'no-store' })
    } catch {
      throw new TokenxError('NETWORK', true)
    }
    const body = await response.json().catch(() => null) as Json | null
    const status = Number(body?.['status'])
    if (response.status === 401) token = null
    if (!response.ok && !(body && Number.isFinite(status))) throw new TokenxError(`HTTP_${response.status}`, response.status >= 500 || response.status === 401 || response.status === 429)
    if (!body || (status !== 0 && status !== 201)) {
      const code = Number.isFinite(status) ? status : response.status
      throw new TokenxError(String(code), !PERMANENT_CODES.has(code))
    }
    return body
  }

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value
    const body = await call(`${config.authUrl}/v1/auth/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}` },
    })
    const result = body['result'] as Json | undefined
    const value = typeof result?.['accessToken'] === 'string' ? result['accessToken'] : null
    if (!value) throw new TokenxError('AUTH_RESPONSE', true)
    const expiresIn = Number(result?.['expiresIn'])
    token = { value, expiresAt: now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3_600_000) - TOKEN_SAFETY_MS }
    return value
  }

  async function authed(path: string, init: RequestInit & { scope?: Record<string, string> } = {}): Promise<Json> {
    const { scope, ...rest } = init
    return call(`${config.basketUrl}${path}`, {
      ...rest,
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json', ...scope },
    })
  }

  function basketBody(basketId: string | null, basket: FiscalBasket, meta: TokenxBasketMeta): Json {
    return {
      ...(basketId ? { basketID: basketId } : {}),
      title: meta.title.slice(0, 40),
      ...(meta.filter ? { filter: meta.filter.slice(0, 40) } : {}),
      ...(meta.checkNumber ? { checkNumber: meta.checkNumber.slice(0, 10) } : {}),
      ...(meta.note ? { note: meta.note.slice(0, 100) } : {}),
      items: basket.items,
      // A bill discount travels as an adjustment so line prices stay true on the receipt.
      ...(basket.discount > 0 ? { adjust: { description: 'İndirim', discountOrSurcharge: 0, type: 0, value: basket.discount } } : {}),
    }
  }

  return {
    /** Tells TokenX where to post results and with which secret header. */
    async setCallback(callbackUrl: string, authHeader: string): Promise<void> {
      await call(`${config.clientSettingsUrl}/v1/client-settings`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ callbackUrl, callbackAuthHeader: authHeader }),
      })
    },

    async getTerminal(terminalId: string): Promise<{ id: string; branchId: string; mode: number }> {
      const body = await authed(`/v1/terminal/${encodeURIComponent(terminalId)}`, { method: 'GET', scope: { 'terminal-id': terminalId } })
      const raw = body['result']
      const row = (Array.isArray(raw) ? raw[0] : raw) as Json | undefined
      if (!row || typeof row['id'] !== 'string' || typeof row['branchId'] !== 'string') throw new TokenxError('TERMINAL_RESPONSE', false)
      return { id: row['id'], branchId: row['branchId'], mode: Number(row['mode']) }
    },

    async getSections(terminalId: string): Promise<FiscalSection[]> {
      const body = await authed('/v1/fiscal-parameters', { method: 'GET', scope: { 'terminal-id': terminalId } })
      const sections = ((body['result'] as Json | undefined)?.['sections'] ?? []) as Json[]
      return sections.flatMap((section) => {
        const sectionNo = Number(section['sectionNo'])
        const taxPercent = Number(section['taxPercent'])
        const active = section['status'] === undefined || Number(section['status']) === 1
        return active && Number.isInteger(sectionNo) && Number.isInteger(taxPercent)
          ? [{ sectionNo, taxPercent, name: typeof section['name'] === 'string' ? section['name'] : `Bölüm ${sectionNo}` }]
          : []
      })
    },

    /** Creates the basket, or replaces its lines when it already exists (TokenX 1007). */
    async putBasket(branchId: string, basketId: string, basket: FiscalBasket, meta: TokenxBasketMeta): Promise<'created' | 'updated'> {
      try {
        await authed('/v1/basket', { method: 'POST', scope: { 'branch-id': branchId }, body: JSON.stringify(basketBody(basketId, basket, meta)) })
        return 'created'
      } catch (error) {
        if (!(error instanceof TokenxError) || error.code !== '1007') throw error
      }
      await authed(`/v1/basket/${encodeURIComponent(basketId)}`, { method: 'PUT', scope: { 'branch-id': branchId }, body: JSON.stringify(basketBody(null, basket, meta)) })
      return 'updated'
    },

    /** Removes an unpaid basket; one that is already gone counts as removed. */
    async deleteBasket(basketId: string): Promise<void> {
      try {
        await authed(`/v1/basket/${encodeURIComponent(basketId)}`, { method: 'DELETE' })
      } catch (error) {
        if (!(error instanceof TokenxError) || error.code !== '1006') throw error
      }
    },
  }
}
