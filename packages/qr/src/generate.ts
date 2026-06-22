import QRCode from 'qrcode'
import sharp from 'sharp'

export interface QROptions {
  url: string
  size?: number
  logoPath?: string        // HTTP/HTTPS URL to logo image
  logoSize?: number        // % of QR size (0–50), default 20
  foregroundColor?: string // hex, default #000000
  backgroundColor?: string // hex, default #ffffff
  shape?: 'square' | 'rounded'
  margin?: number          // quiet zone modules, default 2
}

async function fetchLogoBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function injectRoundedModules(svg: string): string {
  // Add rx/ry to every <rect> to round individual QR modules
  return svg.replace(/<rect /g, '<rect rx="2" ry="2" ')
}

export async function generateQR(opts: QROptions): Promise<Buffer> {
  const {
    url,
    size = 512,
    logoPath,
    logoSize = 20,
    foregroundColor = '#000000',
    backgroundColor = '#ffffff',
    shape = 'square',
    margin = 2,
  } = opts

  let qrBuffer: Buffer

  if (shape === 'rounded') {
    // SVG path: inject rounded rects, then rasterize with Sharp
    const svgString = await QRCode.toString(url, {
      type: 'svg',
      margin,
      color: { dark: foregroundColor, light: backgroundColor },
      errorCorrectionLevel: 'H',
      width: size,
    })
    const roundedSvg = injectRoundedModules(svgString)
    qrBuffer = await sharp(Buffer.from(roundedSvg)).png().toBuffer()
  } else {
    qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: size,
      margin,
      color: { dark: foregroundColor, light: backgroundColor },
      errorCorrectionLevel: 'H',
    })
  }

  if (!logoPath) return qrBuffer

  const logoSizePx = Math.floor(size * (Math.min(logoSize, 40) / 100))
  const logoOffset = Math.floor((size - logoSizePx) / 2)

  const rawLogo = await fetchLogoBuffer(logoPath)
  const logoBuffer = await sharp(rawLogo)
    .resize(logoSizePx, logoSizePx, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp(qrBuffer)
    .composite([{ input: logoBuffer, top: logoOffset, left: logoOffset }])
    .png()
    .toBuffer()
}

export async function generateQRDataURL(opts: QROptions): Promise<string> {
  const buffer = await generateQR(opts)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
