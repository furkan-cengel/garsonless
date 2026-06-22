import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { getAnthropicClient, buildWaiterSystemPrompt, buildMenuBlock, WAITER_TOOLS } from '@garsonless/ai'
import { createServiceClient } from '@garsonless/db'
import type { AnthropicSDK } from '@garsonless/ai'
type MessageParam = AnthropicSDK.MessageParam
type ToolResultBlockParam = AnthropicSDK.ToolResultBlockParam
type ToolUseBlock = AnthropicSDK.ToolUseBlock
import { getMenuCategories, getMenuItems } from '../../../lib/queries'
import type { MenuItem } from '@garsonless/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuForRoute {
  items: MenuItem[]
  categoriesWithItems: Array<{
    name: string
    items: Array<{
      id: string
      name: string
      price: number
      description: string | null
      modifierGroups: Array<{
        name: string
        options: Array<{ id: string; name: string; priceDelta: number }>
      }>
    }>
  }>
}

interface RestaurantSettings {
  ai_waiter_enabled?: boolean
  ai_persona_name?: string
  ai_tone?: string
  ai_language?: string
}

// ─── Request schema ────────────────────────────────────────────────────────────

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  restaurantId: z.string().uuid(),
  sessionId: z.string(),
})

// ─── Menu cache ────────────────────────────────────────────────────────────────

function createCachedMenuFetcher(restaurantId: string) {
  return unstable_cache(
    async (): Promise<MenuForRoute> => {
      const categories = await getMenuCategories(restaurantId)
      const items = await getMenuItems(categories.map((c) => c.id))

      const categoriesWithItems = categories.map((cat) => ({
        name: cat.name,
        items: items
          .filter((i) => i.category_id === cat.id)
          .map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            description: i.description,
            modifierGroups: i.modifier_groups.map((g) => ({
              name: g.name,
              options: g.options.map((o) => ({
                id: o.id,
                name: o.name,
                priceDelta: o.price_delta,
              })),
            })),
          })),
      }))

      return { items, categoriesWithItems }
    },
    [`menu-${restaurantId}`],
    { tags: [`menu:${restaurantId}`], revalidate: 3600 },
  )
}

// ─── Tool handler ──────────────────────────────────────────────────────────────

async function handleToolCall(
  tool: ToolUseBlock,
  menu: MenuForRoute,
  sessionId: string,
  restaurantId: string,
): Promise<string> {
  const input = tool.input as Record<string, unknown>

  if (tool.name === 'add_to_cart') {
    const itemId = input['item_id'] as string
    const quantity = (input['quantity'] as number) ?? 1
    const item = menu.items.find((i) => i.id === itemId)
    if (!item) return 'Item not found in menu'
    return JSON.stringify({ action: 'add_to_cart', item_id: itemId, item_name: item.name, quantity })
  }

  if (tool.name === 'get_item_details') {
    const itemId = input['item_id'] as string
    const item = menu.items.find((i) => i.id === itemId)
    if (!item) return 'Item not found'
    return JSON.stringify({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      modifier_groups: item.modifier_groups,
    })
  }

  if (tool.name === 'call_waiter') {
    return 'Waiter has been notified and will arrive shortly.'
  }

  if (tool.name === 'get_order_status') {
    try {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (!data) return 'No active order found for this session.'
      return JSON.stringify({ order_id: (data as { id: string; status: string; created_at: string }).id, status: (data as { id: string; status: string; created_at: string }).status })
    } catch {
      return 'Could not retrieve order status.'
    }
  }

  return 'Unknown tool'
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

type SSEEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown>; chipLabel: string }
  | { type: 'tool_result'; name: string; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('{"type":"error","message":"Invalid JSON"}\n', { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ type: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid request' }) + '\n',
      { status: 400 },
    )
  }

  const { messages, restaurantId, sessionId } = parsed.data

  // Fetch restaurant settings + menu (cached)
  const supabase = createServiceClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, settings')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    return new Response(JSON.stringify({ type: 'error', message: 'Restaurant not found' }) + '\n', { status: 404 })
  }

  const settings = (restaurant as { name: string; settings: Record<string, unknown> }).settings as RestaurantSettings
  if (settings.ai_waiter_enabled === false) {
    return new Response(JSON.stringify({ type: 'error', message: 'AI waiter is disabled' }) + '\n', { status: 403 })
  }

  const menuData = await createCachedMenuFetcher(restaurantId)()

  // Build prompt blocks (menu uses cache_control for prompt caching)
  const systemPrompt = buildWaiterSystemPrompt({
    restaurantName: (restaurant as { name: string }).name,
    personaName: settings.ai_persona_name ?? 'Garson',
    tone: (settings.ai_tone as 'formal' | 'friendly' | 'playful') ?? 'friendly',
    language: (settings.ai_language as 'tr' | 'en' | 'both') ?? 'tr',
    menuText: '',
  })

  const menuText = buildMenuBlock(menuData.categoriesWithItems)

  const systemBlocks = [
    { type: 'text' as const, text: systemPrompt },
    { type: 'text' as const, text: menuText, cache_control: { type: 'ephemeral' as const } },
  ]

  // Convert incoming messages to Anthropic format
  let currentMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: SSEEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      try {
        const anthropic = getAnthropicClient()

        // Agentic loop — handles up to 3 tool rounds to prevent infinite loops
        for (let round = 0; round < 3; round++) {
          const sdkStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemBlocks,
            messages: currentMessages,
            tools: WAITER_TOOLS,
          })

          sdkStream.on('text', (text) => {
            send({ type: 'delta', text })
          })

          const message = await sdkStream.finalMessage()

          if (message.stop_reason !== 'tool_use') break

          const toolBlocks = message.content.filter(
            (b: AnthropicSDK.ContentBlock): b is ToolUseBlock => b.type === 'tool_use',
          )

          const toolResults: ToolResultBlockParam[] = []

          for (const tool of toolBlocks) {
            const result = await handleToolCall(tool, menuData, sessionId, restaurantId)

            // Build chip label
            let chipLabel = ''
            const resultData = (() => {
              try { return JSON.parse(result) as Record<string, unknown> } catch { return null }
            })()

            if (tool.name === 'add_to_cart' && resultData) {
              chipLabel = `${String(resultData['item_name'])} sepete eklendi ✓`
            } else if (tool.name === 'call_waiter') {
              chipLabel = 'Garson çağrıldı ✓'
            } else if (tool.name === 'get_item_details') {
              chipLabel = 'Detaylar alındı'
            } else if (tool.name === 'get_order_status') {
              chipLabel = 'Sipariş durumu kontrol edildi'
            }

            send({
              type: 'tool_use',
              name: tool.name,
              input: tool.input as Record<string, unknown>,
              chipLabel,
            })

            toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result })
          }

          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: message.content },
            { role: 'user', content: toolResults },
          ]
        }

        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
