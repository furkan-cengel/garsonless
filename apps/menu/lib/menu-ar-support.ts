export type MenuArSupport = 'checking' | 'available' | 'unsupported' | 'desktop'

type ArEnvironment = {
  userAgent: string
  maxTouchPoints: number
  xr?: { isSessionSupported(mode: string): Promise<boolean> }
}

function browserEnvironment(): ArEnvironment {
  const nav = navigator as Navigator & { xr?: ArEnvironment['xr'] }
  return { userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints ?? 0, xr: nav.xr }
}

/**
 * Whether to offer "Masamda gör". iOS opens Quick Look whenever model-viewer
 * can. Android is offered AR only with WebXR immersive-ar: phones without
 * ARCore would otherwise be sent to a Play Store "not compatible" page.
 */
export async function menuArSupport(canActivateAR: boolean, env: ArEnvironment = browserEnvironment()): Promise<MenuArSupport> {
  const android = /Android/i.test(env.userAgent)
  const ios = /iPhone|iPad|iPod/i.test(env.userAgent) || (/Macintosh/i.test(env.userAgent) && env.maxTouchPoints > 1)
  if (!android && !ios) return 'desktop'
  if (!canActivateAR) return 'unsupported'
  if (!android) return 'available'
  const immersive = await env.xr?.isSessionSupported('immersive-ar').catch(() => false)
  return immersive ? 'available' : 'unsupported'
}
