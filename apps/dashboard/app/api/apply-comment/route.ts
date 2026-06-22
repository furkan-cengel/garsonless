import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient } from '@garsonless/ai'
import { createDashboardServerClient } from '../../../lib/supabase-server'
import type { GarsonlessTheme } from '@garsonless/design-engine'

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export interface ApplyCommentResult {
  patch: Partial<GarsonlessTheme>
  explanation: string
}

const requestSchema = z.object({
  comment: z.string().min(1).max(500),
  clickedComponent: z.string().min(1),
  currentTheme: z.record(z.unknown()),
  restaurantId: z.string().uuid(),
})

const COMPONENT_KEYS: Record<string, string[]> = {
  header:  ['headerBg', 'headerStyle', 'headerHeight', 'headerAlign', 'headerBorder', 'headerNameSize', 'headerShowSearch', 'headerShowLang', 'headerTableBadge', 'accent', 'stickyHeader'],
  card:    ['cardLayout', 'cardImageAspect', 'cardShowDesc', 'cardShowTag', 'cardCtaStyle', 'radius', 'shadow', 'border', 'gap', 'cols'],
  catnav:  ['catnavStyle', 'catnavShowIcons', 'catnavShowCount', 'stickyNav', 'accent'],
  cart:    ['cartStyle', 'cartIcon', 'cartShowBadge', 'cta'],
  page:    ['bg', 'accent', 'accentSoft', 'cta', 'bodyFont', 'displayFont', 'fs', 'radius', 'shadow', 'border', 'texture', 'pad', 'sectionGap'],
}

const SYSTEM_PROMPT =
  'You are editing a restaurant menu theme component. ' +
  'Return ONLY valid JSON with the theme keys that need to change. No markdown, no explanation, just JSON.'

function buildUserPrompt(
  comment: string,
  component: string,
  currentTheme: Record<string, unknown>,
): string {
  const keys = COMPONENT_KEYS[component] ?? COMPONENT_KEYS['page']!
  const currentValues = Object.fromEntries(keys.map(k => [k, currentTheme[k]]))

  return (
    `Component: ${component}\n` +
    `User request: "${comment}"\n\n` +
    `Current values for this component:\n${JSON.stringify(currentValues, null, 2)}\n\n` +
    `Type reference:\n` +
    `- Colors are hex strings (e.g. "#ff5500")\n` +
    `- shadow: "none" | "soft" | "hard"\n` +
    `- border: "none" | "hair" | "solid"\n` +
    `- catnavStyle: "pills" | "underline" | "segmented" | "dots" | "outlined"\n` +
    `- cardLayout: "vertical" | "horizontal" | "minimal"\n` +
    `- cardCtaStyle: "icon" | "pill" | "full"\n` +
    `- headerStyle: "solid" | "blur"\n` +
    `- cartStyle: "pill" | "banner" | "fab"\n` +
    `- headerAlign: "left" | "center"\n\n` +
    `Example output: {"headerBg":"#1a1a1a","headerStyle":"blur","explanation":"Başlık koyu ve bulanık arka planla güncellendi."}\n\n` +
    `Return a JSON object with only the keys that need to change, plus an "explanation" key (1 sentence in Turkish).`
  )
}

function parseCommentResponse(text: string): ApplyCommentResult {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as Record<string, unknown>
  const explanation = typeof parsed['explanation'] === 'string' ? parsed['explanation'] : ''
  const { explanation: _exp, ...patch } = parsed
  void _exp
  return { patch: patch as Partial<GarsonlessTheme>, explanation }
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ApplyCommentResult>>> {
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

    const { comment, clickedComponent, currentTheme, restaurantId } = parsed.data

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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildUserPrompt(comment, clickedComponent, currentTheme),
      }],
    })

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const result = parseCommentResponse(rawText)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[apply-comment] ERROR:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
