'use client'

import { useState, useCallback } from 'react'
import type { ChatMessage, ToolChip } from '@garsonless/ui'
import type { MenuItem, SelectedModifier, ModifierGroup } from '@garsonless/ui'
import { useCartStore } from '../../../lib/store/useCartStore'

// ─── Wire-format events (matches route.ts SSEEvent) ───────────────────────────

interface DeltaEvent {
  type: 'delta'
  text: string
}

interface ToolUseEvent {
  type: 'tool_use'
  name: string
  input: Record<string, unknown>
  chipLabel: string
}

interface DoneEvent {
  type: 'done'
}

interface ErrorEvent {
  type: 'error'
  message: string
}

type StreamEvent = DeltaEvent | ToolUseEvent | DoneEvent | ErrorEvent

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function buildModifiers(item: MenuItem, optionIds: string[]): SelectedModifier[] {
  const result: SelectedModifier[] = []
  for (const optionId of optionIds) {
    let foundGroup: ModifierGroup | undefined
    for (const g of item.modifier_groups) {
      if (g.options.some((o) => o.id === optionId)) {
        foundGroup = g
        break
      }
    }
    if (foundGroup) {
      result.push({ group_id: foundGroup.id, option_id: optionId, quantity: 1 })
    }
  }
  return result
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseAIChatOptions {
  restaurantId: string
  sessionId: string
  items: MenuItem[]
}

export function useAIChat({ restaurantId, sessionId, items }: UseAIChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addItem = useCartStore((s: ReturnType<typeof useCartStore.getState>) => s.addItem)

  const handleToolUse = useCallback(
    (event: ToolUseEvent) => {
      if (event.name === 'add_to_cart') {
        const itemId = event.input['item_id'] as string
        const quantity = (event.input['quantity'] as number) ?? 1
        const modifierIds = (event.input['modifiers'] as string[] | undefined) ?? []
        const menuItem = items.find((i) => i.id === itemId)
        if (menuItem) {
          const modifiers = buildModifiers(menuItem, modifierIds)
          addItem(menuItem, modifiers, menuItem.modifier_groups, quantity)
        }
      }
    },
    [items, addItem],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return
      setError(null)
      setInputValue('')

      const userMsg: ChatMessage = { id: genId(), role: 'user', text }

      // Build history for the API (exclude tool chips, just text)
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.text.length > 0)
        .map((m) => ({ role: m.role, content: m.text }))

      const assistantId = genId()
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', text: '', toolChips: [] }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsLoading(true)

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: historyForApi, restaurantId, sessionId }),
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            let event: StreamEvent
            try {
              event = JSON.parse(trimmed) as StreamEvent
            } catch {
              continue
            }

            if (event.type === 'delta') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + event.text } : m,
                ),
              )
            } else if (event.type === 'tool_use') {
              const chip: ToolChip = {
                id: genId(),
                name: event.name,
                label: event.chipLabel,
                status: 'done',
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolChips: [...(m.toolChips ?? []), chip] }
                    : m,
                ),
              )
              handleToolUse(event)
            } else if (event.type === 'error') {
              setError(event.message)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bağlantı hatası')
        // Remove the empty assistant message on failure
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.text === '' && !m.toolChips?.length)))
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages, restaurantId, sessionId, handleToolUse],
  )

  return {
    messages,
    isLoading,
    error,
    inputValue,
    setInputValue,
    sendMessage,
  }
}
