import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('cart boundary rejects incomplete modifier selections before mutating state', () => {
  const cartStore = readFileSync(new URL('./store/useCartStore.ts', import.meta.url), 'utf8')
  const validationGuard = cartStore.indexOf(
    'if (!areModifierSelectionsValid(modifierGroups, modifiers)) return',
  )
  const cartMutation = cartStore.indexOf('const existingIndex = get().items.findIndex')

  assert.match(
    cartStore,
    /import \{ areModifierSelectionsValid \} from '@garsonless\/ui\/menu'/,
  )
  assert.ok(validationGuard >= 0, 'cart store must validate modifier selections')
  assert.ok(
    validationGuard < cartMutation,
    'modifier validation must happen before any cart identity or mutation work',
  )
})
