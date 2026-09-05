const CHECKOUT_MOUNT = '<div id="iyzipay-checkout-form" class="responsive"></div>'
const MAX_CHECKOUT_CONTENT_BYTES = 512 * 1024

export type IyzicoCheckoutEnvironment = 'sandbox' | 'live'

const ENVIRONMENT_CONFIG = {
  sandbox: {
    apiHost: 'sandbox-api.iyzipay.com',
    allowedResourceHosts: new Set(['sandbox-static.iyzipay.com', 'cdnsandbox.iyzipay.com']),
  },
  live: {
    apiHost: 'api.iyzipay.com',
    allowedResourceHosts: new Set(['static.iyzipay.com', 'cdn.iyzipay.com']),
  },
} as const

export type ValidatedIyzicoCheckoutContent = {
  environment: IyzicoCheckoutEnvironment
  content: string
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function hostOf(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

function scriptBodiesOnly(content: string): boolean {
  const scripts = content.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)
  if (!scripts?.length) return false
  return scripts.reduce((remaining, script) => remaining.replace(script, ''), content).trim() === ''
}

function referencedResourceUrls(content: string): string[] {
  const urls = new Set<string>()
  const patterns = [
    /<script\b[^>]*\bsrc\s*=\s*(["'])(https:\/\/[^"']+)\1/gi,
    /setAttribute\s*\(\s*(["'])(?:src|href)\1\s*,\s*(["'])(https:\/\/[^"']+)\2\s*\)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match.slice(1).find((part) => part?.startsWith('https://'))
      if (value) urls.add(value)
    }
  }
  return [...urls]
}

/**
 * The hosted response is active JavaScript and is trusted only when it has the
 * documented iyzico loader shape and loads code from iyzico's static hosts.
 * This is a trust-boundary check, not a general JavaScript sanitizer.
 */
export function validateIyzicoCheckoutContent(
  providerContent: string,
  expectedEnvironment?: IyzicoCheckoutEnvironment,
): ValidatedIyzicoCheckoutContent | null {
  if (byteLength(providerContent) > MAX_CHECKOUT_CONTENT_BYTES) return null
  const content = providerContent.trim()
  if (!content || !scriptBodiesOnly(content)) return null
  if (!/\biyziInit\b/.test(content)
    || !/document\.createElement\s*\(\s*(["'])script\1\s*\)/i.test(content)
    || !/\.createTag\s*\(\s*\)/.test(content)) return null

  const environment = content.includes(`https://${ENVIRONMENT_CONFIG.sandbox.apiHost}`)
    ? 'sandbox'
    : content.includes(`https://${ENVIRONMENT_CONFIG.live.apiHost}`)
      ? 'live'
      : null
  if (!environment || (expectedEnvironment && environment !== expectedEnvironment)) return null

  const resourceUrls = referencedResourceUrls(content)
  if (resourceUrls.length === 0) return null
  const allowedHosts: ReadonlySet<string> = ENVIRONMENT_CONFIG[environment].allowedResourceHosts
  if (resourceUrls.some((url) => {
    const host = hostOf(url)
    return !host || !allowedHosts.has(host)
  })) return null

  return { environment, content }
}

function checkoutCsp(environment: IyzicoCheckoutEnvironment): string {
  const sources = environment === 'sandbox'
    ? [
      'https://sandbox-api.iyzipay.com',
      'https://sandbox-merchantgw.iyzipay.com',
      'https://sandbox-consumerapigw.iyzipay.com',
      'https://sandbox-gql.iyzipay.com',
      'https://sandbox-static.iyzipay.com',
      'https://cdnsandbox.iyzipay.com',
      'https://sandbox-cpp.iyzipay.com',
    ]
    : [
      'https://api.iyzipay.com',
      'https://merchantgw.iyzipay.com',
      'https://consumerapigw.iyzipay.com',
      'https://gql.iyzipay.com',
      'https://static.iyzipay.com',
      'https://cdn.iyzipay.com',
      'https://cpp.iyzipay.com',
    ]
  const all = sources.join(' ')
  const scripts = sources.filter((source) => source.includes('static') || source.includes('cdn')).join(' ')
  // iyzico's sandbox runtime intentionally serves shared visual assets from
  // the live static/CDN origins as well as its sandbox loader origin.
  const assets = [...new Set([
    ...sources,
    'https://cdn.iyzipay.com',
    'https://static.iyzipay.com',
  ])].join(' ')
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${scripts}`,
    `style-src 'unsafe-inline' ${assets}`,
    `connect-src ${all}`,
    `img-src data: blob: ${assets}`,
    `font-src data: ${assets}`,
    `frame-src ${all}`,
    // iyzico completes the hosted flow by POSTing its token back to the
    // merchant callback. srcdoc inherits the dashboard origin, so self is the
    // narrow environment-independent callback permission.
    `form-action 'self' ${all}`,
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')
}

function mountObserver(nonce: string): string {
  const serializedNonce = JSON.stringify(nonce).replaceAll('<', '\\u003c')
  return `<script>
  (() => {
    const nonce = ${serializedNonce};
    let acknowledged = false;
    let attempts = 0;
    const notifyWhenMounted = () => {
      const mount = document.getElementById('iyzipay-checkout-form');
      if (acknowledged || !mount || !mount.hasChildNodes()) return;
      window.parent.postMessage({ type: 'masabu:iyzico-mounted', nonce }, '*');
      observer.disconnect();
      attempts += 1;
      if (attempts < 40) setTimeout(notifyWhenMounted, 250);
    };
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === 'masabu:iyzico-mounted-ack' && event.data?.nonce === nonce) acknowledged = true;
    });
    document.addEventListener('submit', () => {
      window.parent.postMessage({ type: 'masabu:iyzico-attempting', nonce }, '*');
    }, { capture: true });
    window.addEventListener('beforeunload', () => {
      window.parent.postMessage({ type: 'masabu:iyzico-navigating', nonce }, '*');
    });
    const observer = new MutationObserver(notifyWhenMounted);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', notifyWhenMounted, { once: true });
    setTimeout(notifyWhenMounted, 0);
  })();
  </script>`
}

/**
 * iyzico returns loader scripts rather than a complete document. The responsive
 * mount and parent handshake must exist before those provider scripts run.
 */
export function createIyzicoCheckoutDocument(providerContent: string, nonce: string): string {
  const validated = validateIyzicoCheckoutContent(providerContent)
  if (!validated || !nonce.trim()) throw new Error('Invalid iyzico checkout document input')
  const csp = checkoutCsp(validated.environment).replaceAll('"', '&quot;')
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>İyzico güvenli ödeme</title>
  <style>
    html, body { min-height: 100%; margin: 0; background: #fff; color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    #iyzipay-checkout-form { min-height: 100%; font-family: inherit; }
    #iyzipay-checkout-form button,
    #iyzipay-checkout-form input,
    #iyzipay-checkout-form select,
    #iyzipay-checkout-form textarea { font-family: inherit; }
  </style>
</head>
<body>
  ${CHECKOUT_MOUNT}
  ${mountObserver(nonce)}
  ${validated.content}
</body>
</html>`
}
