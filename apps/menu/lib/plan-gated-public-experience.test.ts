import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homePage = readFileSync(new URL('../app/[slug]/page.tsx', import.meta.url), 'utf8')
const menuExperience = readFileSync(new URL('../app/[slug]/_menu-experience.tsx', import.meta.url), 'utf8')
const tablePage = readFileSync(new URL('../app/[slug]/table/[tableId]/page.tsx', import.meta.url), 'utf8')
const homeClient = readFileSync(new URL('../app/[slug]/HomePageClient.tsx', import.meta.url), 'utf8')

test('public menu surfaces resolve subscription-aware plan features on the server', () => {
  for (const source of [homePage, menuExperience, tablePage]) {
    assert.match(source, /feature: 'qr_menu'/)
    assert.match(source, /feature: 'theme_advanced_sections'/)
    assert.match(source, /withoutAdvancedThemeSections/)
  }
  for (const source of [homePage, menuExperience, tablePage]) {
    assert.match(source, /feature: 'guest_ordering'/)
    assert.match(source, /feature: 'customer_accounts'/)
  }
})

test('home account and cart controls disappear when their Pro entitlements are absent', () => {
  assert.match(homeClient, /guestOrderingEnabled \? \{[\s\S]+cartSummary/)
  assert.match(homeClient, /customerAccountsEnabled \? \{ memberSummary, onOpenMember/)
  assert.match(homeClient, /customerAccountsEnabled && memberOpen \? <MemberSheet/)
})
