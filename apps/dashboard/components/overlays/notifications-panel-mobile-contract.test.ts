import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./NotificationsPanel.tsx', import.meta.url), 'utf8')

test('notification dialog stays inside narrow viewports and becomes a mobile bottom sheet', () => {
  assert.match(source, /width:min\(400px,calc\(100vw - 32px\)\)/)
  assert.match(source, /@media \(max-width:640px\)[\s\S]*?\.dashboard-notifications-panel \{[\s\S]*?width:100%/)
  assert.match(source, /max-height:min\(84dvh,720px\)/)
  assert.match(source, /border-radius:18px 18px 0 0/)
  assert.match(source, /padding-bottom:env\(safe-area-inset-bottom\)/)
  assert.doesNotMatch(source, /width:\s*400,\s*maxHeight/)
})

test('notification dialog owns scrolling, focus and an explicit close action', () => {
  assert.match(source, /useModalDialogFocus\(onClose\)/)
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /aria-labelledby="dashboard-notifications-title"/)
  assert.match(source, /className="dashboard-notifications-list"/)
  assert.match(source, /min-height:0;overflow-x:hidden;overflow-y:auto/)
  assert.match(source, /overscroll-behavior-y:contain/)
  assert.match(source, /aria-label="Bildirimleri kapat"/)
  assert.match(source, /data-dialog-initial-focus/)
})

test('notification content keeps mobile actions tappable and long copy wrapped', () => {
  assert.match(source, /\.dashboard-notifications-mark-all \{ min-height:44px/)
  assert.match(source, /\.dashboard-notifications-close \{ width:44px;height:44px/)
  assert.match(source, /\.dashboard-notification-footer-action \{ min-height:44px/)
  assert.match(source, /\.dashboard-notification-copy \{ overflow-wrap:anywhere/)
})
