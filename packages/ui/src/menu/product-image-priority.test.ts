import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { DefaultMenuPage } from '../themes/default/MenuPage'
import { ThemeProvider } from './ThemeContext'
import type { MenuCategory, MenuItem } from './types'

Object.assign(globalThis, { React })

function renderPriority(order: string[], imageCategories: string[], visual = false) {
  const calls: [string, boolean | undefined][] = []
  const categories = ['database-first', 'theme-first', 'text-only'].map((id) => ({
    id, name: id, parent_id: null,
  })) as MenuCategory[]
  const items = imageCategories.map((category_id) => ({
    id: `${category_id}-product`, category_id, images: ['/product.webp'],
  })) as MenuItem[]
  renderToStaticMarkup(React.createElement(ThemeProvider, {
    initialTheme: {
      ...DEFAULT_THEME,
      catnavStyle: visual ? 'visual' : 'underline',
      pageBlocks: [{ type: 'nav', id: 'category-nav' }, ...order.map((id) => ({ type: 'category' as const, id }))],
    },
    children: React.createElement(DefaultMenuPage, {
      categories, items,
      renderItems: (id, priority) => { calls.push([id, priority]); return null },
    }),
  }))
  return calls.filter(([, priority]) => priority).map(([id]) => id)
}

test('SSR image priority follows published theme order, not database order', () => {
  assert.deepEqual(renderPriority(
    ['theme-first', 'database-first'], ['database-first', 'theme-first'],
  ), ['theme-first'])
})

test('text-only categories and filtered-out products do not consume image priority', () => {
  assert.deepEqual(renderPriority(
    ['text-only', 'theme-first', 'database-first'], ['database-first'],
  ), ['database-first'])
  assert.deepEqual(renderPriority(['theme-first', 'database-first'], []), [])
})

test('visual category landing does not eagerly load hidden product cards', () => {
  assert.deepEqual(renderPriority(
    ['theme-first', 'database-first'], ['theme-first', 'database-first'], true,
  ), [])
})
