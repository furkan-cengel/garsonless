import assert from 'node:assert/strict'
import test from 'node:test'
import {
  campaignEmailDesignToPlainText,
  normalizeCampaignEmailDesign,
  normalizeCampaignAudience,
  normalizeCampaignEmailContent,
  sanitizeCampaignMessage,
  sanitizeCampaignName,
  sanitizeCampaignSubject,
  renderCampaignBuilderEmail,
} from './campaigns'

test('campaign copy is whitespace-normalized and transport bounded', () => {
  assert.equal(sanitizeCampaignMessage('  Merhaba\n\nMasabu  '), 'Merhaba Masabu')
  assert.equal(sanitizeCampaignMessage('x'.repeat(500)).length, 459)
  assert.equal(sanitizeCampaignName('', new Date('2026-07-16T12:00:00Z')), 'SMS 16.07')
  assert.equal(sanitizeCampaignName('', new Date('2026-07-16T12:00:00Z'), 'email'), 'E-posta 16.07')
  assert.equal(sanitizeCampaignMessage('x'.repeat(6_000), 'email').length, 5_000)
  assert.equal(sanitizeCampaignSubject('  Yeni\n fırsatlar  '), 'Yeni fırsatlar')
})

test('email design selection falls back to a safe ready template', () => {
  assert.deepEqual(normalizeCampaignEmailContent({}), {
    contentMode: 'template', templateId: 'announcement',
  })
  assert.deepEqual(normalizeCampaignEmailContent({ contentMode: 'html', templateId: 'offer' }), {
    contentMode: 'html', templateId: null,
  })
  assert.deepEqual(normalizeCampaignEmailContent({ contentMode: 'builder', templateId: 'offer' }), {
    contentMode: 'builder', templateId: null,
  })
})

test('block email designs bound unsafe values and render responsive email primitives', () => {
  const design = normalizeCampaignEmailDesign({
    backgroundColor: 'red', fontFamily: 'comic-sans', maxWidth: 99,
    blocks: [
      { id: '<bad>', type: 'heading', text: '{{restaurant_name}}', color: '#123456', align: 'center' },
      { id: 'image', type: 'image', src: 'javascript:alert(1)', href: 'http://unsafe.test', alt: '<script>', borderRadius: 999 },
      { id: 'grid', type: 'grid', columns: 3, items: Array.from({ length: 8 }, (_, i) => ({ title: `Kart ${i}`, text: 'Açıklama' })) },
    ],
  })
  assert.equal(design.backgroundColor, '#f4f5f3')
  assert.equal(design.fontFamily, 'arial')
  assert.equal(design.maxWidth, 480)
  assert.equal(design.blocks[1]?.type === 'image' ? design.blocks[1].src : 'missing', '')
  assert.equal(design.blocks[2]?.type === 'grid' ? design.blocks[2].items.length : 0, 3)
  const html = renderCampaignBuilderEmail({ design, restaurantName: 'MAF <Cafe>' })
  assert.match(html, /MAF &lt;Cafe&gt;/)
  assert.doesNotMatch(html, /javascript:|<script>/i)
  assert.match(html, /pazarlama iletişimine izin verdiğiniz/)
  assert.match(campaignEmailDesignToPlainText(design), /Kart 0/)
})

test('campaign audiences fall back safely and keep the closed builtin vocabulary', () => {
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'builtin', builtinSegment: 'frequent' }), {
    segmentKind: 'builtin', builtinSegment: 'frequent', customSegmentId: null,
  })
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'custom', customSegmentId: 'segment-id' }), {
    segmentKind: 'custom', builtinSegment: null, customSegmentId: 'segment-id',
  })
  assert.deepEqual(normalizeCampaignAudience({ segmentKind: 'builtin', builtinSegment: null }), {
    segmentKind: 'all', builtinSegment: null, customSegmentId: null,
  })
})
