import type Anthropic from '@anthropic-ai/sdk'

export type WaiterTone = 'formal' | 'friendly' | 'playful'
export type WaiterLanguage = 'tr' | 'en' | 'both'

export interface WaiterSettings {
  enabled: boolean
  personaName: string
  tone: WaiterTone
  language: WaiterLanguage
}

export interface WaiterContext {
  restaurantName: string
  personaName: string
  language: WaiterLanguage
  tone: WaiterTone
  menuText: string
}

function toneInstruction(tone: WaiterTone): string {
  if (tone === 'formal') return 'polite and professional'
  if (tone === 'playful') return 'warm, fun, and enthusiastic'
  return 'friendly and approachable'
}

function languageInstruction(lang: WaiterLanguage): string {
  if (lang === 'tr') return 'You always respond in Turkish.'
  if (lang === 'en') return 'You always respond in English.'
  return 'Detect the customer language and respond in the same language (Turkish or English).'
}

export function buildWaiterSystemPrompt(ctx: WaiterContext): string {
  return `You are ${ctx.personaName}, the AI assistant for ${ctx.restaurantName}.
Be ${toneInstruction(ctx.tone)}.
${languageInstruction(ctx.language)}

RULES:
- Never invent menu items or prices not in the menu below
- Never discuss competitors or politics
- If unsure about an item's details, call get_item_details before answering
- Upsell thoughtfully (add-ons, drinks, desserts) without being pushy
- For complaints or urgent situations, call call_waiter immediately
- When a customer wants to order, use add_to_cart — never ask them to do it themselves
- Keep responses concise (2-3 sentences max) unless explaining a dish in detail`
}

export function buildMenuBlock(
  categories: Array<{ name: string; items: Array<{ id: string; name: string; price: number; description?: string | null; modifierGroups?: Array<{ name: string; options: Array<{ id: string; name: string; priceDelta: number }> }> }> }>
): string {
  const lines: string[] = ['## MENU']
  for (const cat of categories) {
    lines.push(`\n### ${cat.name}`)
    for (const item of cat.items) {
      const price = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.price)
      const desc = item.description ? ` — ${item.description}` : ''
      lines.push(`- [${item.id}] ${item.name} ${price}${desc}`)
      if (item.modifierGroups && item.modifierGroups.length > 0) {
        for (const g of item.modifierGroups) {
          const opts = g.options.map((o) => `${o.name}${o.priceDelta > 0 ? ` +${o.priceDelta}₺` : ''}`).join(', ')
          lines.push(`  • ${g.name}: ${opts}`)
        }
      }
    }
  }
  return lines.join('\n')
}

export const WAITER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_to_cart',
    description: 'Add a menu item to the customer cart. Use when the customer wants to order something.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'UUID of the menu item from the menu' },
        quantity: { type: 'number', description: 'Number of items to add (default 1)' },
        modifiers: {
          type: 'array',
          description: 'Selected modifier option IDs (the UUID values shown after each modifier option)',
          items: { type: 'string' },
        },
      },
      required: ['item_id', 'quantity'],
    },
  },
  {
    name: 'get_item_details',
    description: 'Get full details for a menu item including allergens and all modifier options',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'UUID of the menu item' },
      },
      required: ['item_id'],
    },
  },
  {
    name: 'call_waiter',
    description: 'Notify a human waiter to come to the table',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the waiter is being called' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'get_order_status',
    description: 'Get the current status of the active order for this session',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]
