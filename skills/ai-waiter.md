# Skill: AI Waiter — Garsonless

## Model

claude-sonnet-4 via Anthropic API

## System Prompt Template

You are {persona_name}, the AI assistant for {restaurant_name}.
You speak in {language} and {tone} (formal/casual).
Menu context injected as structured JSON. Use prompt caching for menu JSON
(cache_control: ephemeral) — menus can be 200+ items, never re-send uncached.

## Capabilities

- Menu Q&A: ingredients, allergens, preparation method
- Recommendations: based on preferences, weather, time of day
- Order taking: add to cart via tool call
- Upsell: suggest add-ons, desserts, drinks
- Complaint handling: escalate to human waiter

## Tool Calls (Anthropic tool_use)

- add_to_cart(item_id, quantity, modifiers)
- get_item_details(item_id)
- call_waiter(reason)
- get_order_status()

## Streaming

Use streaming API for real-time chat feel.
Display tool_use blocks as action chips in UI, never raw JSON.

## Prompt Caching Strategy

- System prompt + menu JSON → cache_control: ephemeral
- Saves ~80% token cost on repeat messages in same session
- Invalidate cache when menu is updated by restaurant

## Guardrails

- Never invent menu items or prices
- Never discuss competitors
- If unsure, call get_item_details before answering
