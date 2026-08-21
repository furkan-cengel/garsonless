import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { CHEF_SECTION_ICON_OPTIONS, ChefSectionIcon } from './ChefSectionIcon'

test('chef section icon sprite preserves the requested 4x4 Recraft order', () => {
  const html = renderToStaticMarkup(
    <div>{CHEF_SECTION_ICON_OPTIONS.map((option) => <ChefSectionIcon key={option.value} name={option.value} width={20} height={20} />)}</div>,
  )

  assert.equal((html.match(/data-chef-section-icon=/g) ?? []).length, 16)
  assert.match(html, /data-chef-section-icon="catal-kasik"/)
  assert.match(html, /mask-position:0% 0%/)
  assert.match(html, /data-chef-section-icon="tabaklama"/)
  assert.match(html, /mask-position:33\.333333% 33\.333333%/)
  assert.match(html, /data-chef-section-icon="zamanlayici"/)
  assert.match(html, /mask-position:100% 100%/)
  assert.match(html, /background-color:currentColor/)
  assert.match(html, /\/brand\/chef-section-icons\.svg/)
})
