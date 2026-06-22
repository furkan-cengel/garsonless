import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient } from '@garsonless/ai'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import type { GarsonlessTheme } from '@garsonless/design-engine'

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export interface GenerateThemeResult {
  theme: GarsonlessTheme
  description: string
}

const requestSchema = z.object({
  mode: z.enum(['prompt', 'photo', 'chat']),
  prompt: z.string().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  restaurantName: z.string().min(1),
  currentTheme: z.record(z.unknown()),
  restaurantId: z.string().uuid(),
})

const GARSONLESS_THEME_SCHEMA = `{
  "bg": "string (hex color — page background)",
  "bodyFont": "string (Google Font name for body text)",
  "displayFont": "string (Google Font name for headings/titles)",
  "fs": "number (base font size in px, 13-18)",
  "lh": "number (line height percent, 130-165)",
  "radius": "number (border radius in px, 0-24)",
  "shadow": "'none' | 'soft' | 'hard'",
  "border": "'none' | 'hair' | 'solid'",
  "accent": "string (hex — primary brand color)",
  "accentSoft": "string (hex — light/pastel version of accent, used for tag backgrounds)",
  "cta": "string (hex — call-to-action / add-to-cart button color)",
  "texture": "'solid' | 'noise' | 'grid'",
  "motion": "'full' | 'reduced' | 'none'",
  "showSelection": "boolean",
  "cols": "number (grid columns, 1-3)",
  "gap": "number (card gap in px, 8-20)",
  "pad": "number (page horizontal padding in px, 12-24)",
  "sectionGap": "number (gap between category sections in px, 12-32)",
  "stickyHeader": "boolean",
  "stickyNav": "boolean",
  "headerAlign": "'left' | 'center'",
  "headerLogoStyle": "'display' | 'wordmark' | 'image'",
  "headerShowSearch": "boolean",
  "headerShowLang": "boolean",
  "headerTableBadge": "boolean",
  "headerStyle": "'solid' | 'blur'",
  "catnavStyle": "'pills' | 'underline' | 'segmented' | 'dots' | 'outlined'",
  "catnavShowIcons": "boolean",
  "catnavShowCount": "boolean",
  "cardLayout": "'vertical' | 'horizontal' | 'minimal'",
  "cardImageAspect": "'1:1' | '4:3' | '16:9'",
  "cardShowDesc": "boolean",
  "cardShowTag": "boolean",
  "cardCtaStyle": "'icon' | 'pill' | 'full'",
  "cartStyle": "'pill' | 'banner' | 'fab'",
  "cartIcon": "'cart' | 'bag' | 'basket'",
  "cartShowBadge": "boolean",
  "headerTagline": "string (optional tagline shown under restaurant name)",
  "cartButtonText": "string",
  "cartEmptyText": "string",
  "pageDescription": "string",
  "announcementEnabled": "boolean",
  "announcementText": "string",
  "announcementBg": "string (hex)",
  "announcementColor": "string (hex)",
  "announcementStyle": "'static' | 'marquee' | 'fade' | 'slide'",
  "announcementSpeed": "number (1-10)",
  "headerHeight": "number (px, 48-80)",
  "headerBg": "string (hex — header background)",
  "headerBorder": "boolean",
  "headerShowMenu": "boolean",
  "headerNameSize": "number (px, 18-52)",
  "headerLayout": "'classic' | 'hero' | 'minimal-strip' | 'transparent' — choose FIRST; hero=tall centered image-forward, minimal-strip=40px functional, transparent=overlay nightlife, classic=standard",
  "categoryDisplay": "'horizontal' | 'none' | 'fullscreen-tabs' | 'sidebar-fixed' — sidebar-fixed for 6+ categories, fullscreen-tabs for 3-5 main sections, none for single-category",
  "cardStyle": "'default' | 'borderless' | 'image-hero' | 'pill-row' — image-hero for food-photography menus, borderless for premium/minimal, pill-row for fast lists",
  "itemNameStyle": "'accent' | 'dark' | 'large' — dark for dark backgrounds or minimal themes, large for editorial feel",
  "priceDisplay": "'right' | 'below' | 'pill' — below for editorial, pill for branded/playful menus",
  "sectionHeading": "'accent' | 'editorial' | 'catalog' — editorial for upscale/creative, catalog for cafe/functional, accent for branded"
}`

const SYSTEM_PROMPT =
  'You are an expert restaurant brand designer and UI/UX specialist. ' +
  'You create complete digital menu themes. Always respond with valid JSON only, no markdown, no explanation. ' +
  'STRUCTURAL DECISION PRIORITY: Choose headerLayout, categoryDisplay, cardStyle, sectionHeading BEFORE picking colors or fonts. ' +
  'These structural choices create the most visual diversity between themes.'

function buildPromptMessage(restaurantName: string, prompt: string): string {
  return (
    `Create a complete digital menu theme for a restaurant called '${restaurantName}' described as: '${prompt}'\n\n` +
    `Consider: color psychology for the cuisine type, font pairing that matches the atmosphere, ` +
    `layout that works for the menu size, and overall visual identity consistency.\n\n` +
    `Return ONLY a JSON object with exactly two keys:\n` +
    `- 'theme': Complete GarsonlessTheme object with ALL 63 fields\n` +
    `- 'description': 2 sentences in Turkish explaining design choices\n\n` +
    `GarsonlessTheme schema:\n${GARSONLESS_THEME_SCHEMA}`
  )
}

function buildPhotoMessage(): string {
  return (
    `Analyze this restaurant photo/logo/interior image.\n` +
    `Extract the visual identity: dominant colors, typography style, atmosphere, cuisine type, target demographic.\n\n` +
    `Create a complete digital menu theme that perfectly matches this restaurant's brand identity.\n\n` +
    `Return ONLY a JSON object with exactly two keys:\n` +
    `- 'theme': Complete GarsonlessTheme with ALL 63 fields\n` +
    `- 'description': 2 sentences in Turkish explaining choices\n\n` +
    `GarsonlessTheme schema:\n${GARSONLESS_THEME_SCHEMA}`
  )
}

function buildChatMessage(restaurantName: string, prompt: string, currentTheme: Record<string, unknown>): string {
  return (
    `You are editing an existing restaurant menu theme.\n` +
    `Restaurant: '${restaurantName}'\n` +
    `User request: '${prompt}'\n\n` +
    `Current theme:\n${JSON.stringify(currentTheme)}\n\n` +
    `Make the requested changes while keeping unchanged values the same. ` +
    `Be creative but stay true to the restaurant's identity.\n\n` +
    `Return ONLY a JSON object with exactly two keys:\n` +
    `- 'theme': Complete updated GarsonlessTheme with ALL 63 fields\n` +
    `- 'description': 1 sentence in Turkish describing what changed`
  )
}

function parseResponse(text: string): GenerateThemeResult {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as { theme: GarsonlessTheme; description: string }
  if (!parsed.theme?.bg || !parsed.theme?.accent || !parsed.theme?.bodyFont) {
    throw new Error('Invalid theme: missing required fields')
  }
  return { theme: parsed.theme, description: parsed.description ?? '' }
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<GenerateThemeResult>>> {
  try {
    const supabase = await createDashboardServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json() as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { mode, prompt, imageBase64, mimeType, restaurantName, currentTheme, restaurantId } = parsed.data

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!restaurant) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 })
    }

    let anthropic
    try {
      anthropic = getAnthropicClient()
    } catch {
      return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 503 })
    }

    let rawText: string

    if (mode === 'photo') {
      if (!imageBase64) {
        return NextResponse.json({ success: false, error: 'Missing imageBase64 for photo mode' }, { status: 400 })
      }
      const mediaType = (mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: buildPhotoMessage() },
          ],
        }],
      })
      rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    } else {
      const userText = mode === 'chat'
        ? buildChatMessage(restaurantName, prompt ?? '', currentTheme)
        : buildPromptMessage(restaurantName, prompt ?? '')

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
      })
      rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    }

    const result = parseResponse(rawText)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[generate-theme] ERROR:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
