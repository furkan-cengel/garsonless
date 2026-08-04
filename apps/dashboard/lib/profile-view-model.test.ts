import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDashboardProfileViewModel,
  profileInitials,
  safeProfileAvatarUrl,
} from './profile-view-model'

test('profile view model prefers verified metadata and has deterministic initials', () => {
  assert.deepEqual(createDashboardProfileViewModel({
    email: 'fallback.user@example.com',
    metadata: { display_name: '  Ayşe Bora  ', full_name: 'Ignored', avatar_url: 'https://cdn.example.com/a.png' },
  }), {
    displayName: 'Ayşe Bora',
    initials: 'AB',
    avatarUrl: 'https://cdn.example.com/a.png',
  })
  assert.equal(profileInitials('çağrı'), 'ÇA')
})

test('profile avatar policy accepts credential-free HTTPS and rejects unsafe schemes', () => {
  assert.equal(safeProfileAvatarUrl('https://images.example.com/u.png'), 'https://images.example.com/u.png')
  assert.equal(safeProfileAvatarUrl('http://images.example.com/u.png'), null)
  assert.equal(safeProfileAvatarUrl('https://user:secret@images.example.com/u.png'), null)
  assert.equal(safeProfileAvatarUrl('data:image/png;base64,abc'), null)
})

test('profile view model falls back through OAuth picture, email local-part, and generic user', () => {
  assert.deepEqual(createDashboardProfileViewModel({ email: 'demo.user@example.com', metadata: { picture: 'https://images.example.com/oauth.png' } }), {
    displayName: 'demo.user',
    initials: 'DU',
    avatarUrl: 'https://images.example.com/oauth.png',
  })
  assert.equal(createDashboardProfileViewModel({ email: '', metadata: null }).displayName, 'Kullanıcı')
})
