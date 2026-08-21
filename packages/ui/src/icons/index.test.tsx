import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AppIcons } from './index'

test('menu dish icon is a compact currentColor SVG without Recraft metadata', () => {
  const html = renderToStaticMarkup(<AppIcons.menuDish size={24} className="menu-icon" />)

  assert.match(html, /width="24"/)
  assert.match(html, /height="24"/)
  assert.match(html, /viewBox="100 50 824 824"/)
  assert.equal((html.match(/<path/g) ?? []).length, 2)
  assert.equal((html.match(/fill="currentColor"/g) ?? []).length, 2)
  assert.doesNotMatch(html, /metadata|c2pa|#2F3B41/)
})
