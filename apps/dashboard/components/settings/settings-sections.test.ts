import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SETTINGS_SECTION_IDS,
  canAccessSettingsSection,
  resolveSettingsSection,
} from './settings-sections'

test('the settings URL contract contains fifteen unique sections including owner privacy tools', () => {
  assert.equal(SETTINGS_SECTION_IDS.length, 15)
  assert.equal(new Set(SETTINGS_SECTION_IDS).size, SETTINGS_SECTION_IDS.length)
  assert.equal(canAccessSettingsSection('privacy', false), false)
})

test('an owner can deep-link to every settings section', () => {
  for (const section of SETTINGS_SECTION_IDS) {
    assert.equal(resolveSettingsSection(section, true), section)
  }
})

test('a settings member can deep-link only to member-visible sections', () => {
  for (const section of SETTINGS_SECTION_IDS) {
    const resolved = resolveSettingsSection(section, false)
    assert.equal(resolved, canAccessSettingsSection(section, false) ? section : 'profile')
  }
})

test('missing and invalid section values resolve to the role default', () => {
  assert.equal(resolveSettingsSection(undefined, true), 'workspace')
  assert.equal(resolveSettingsSection('unknown', true), 'workspace')
  assert.equal(resolveSettingsSection(['billing'], true), 'workspace')
  assert.equal(resolveSettingsSection(undefined, false), 'profile')
})
