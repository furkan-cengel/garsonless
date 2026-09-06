import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_CAMPAIGN_EMAIL_DESIGN, normalizeCampaignEmailDesign } from '@garsonless/domain/campaigns'
import { campaignDesignIssue } from './campaign-composer-policy'

const valid = () => { const design = normalizeCampaignEmailDesign(DEFAULT_CAMPAIGN_EMAIL_DESIGN); design.blocks = design.blocks.filter(block => block.type !== 'button'); return design }
test('complete text campaigns are ready and missing button destinations are actionable', () => {
  assert.equal(campaignDesignIssue(valid()), null)
  assert.match(campaignDesignIssue(DEFAULT_CAMPAIGN_EMAIL_DESIGN)!, /3\. element.*HTTPS/)
})
test('partial URL editing is preserved but cannot become a sendable campaign', () => {
  const design = valid()
  design.blocks.push({ id: 'image', type: 'image', src: 'https:', alt: 'Ürün', href: '', borderRadius: 8 })
  assert.match(campaignDesignIssue(design)!, /Görsel/)
  assert.equal(design.blocks[2]?.type === 'image' && design.blocks[2].src, 'https:')
  Object.assign(design.blocks[2]!, { src: 'https://example.com/photo.png' })
  assert.equal(campaignDesignIssue(design), null)
  for (const src of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'https://example.com/a b']) {
    Object.assign(design.blocks[2]!, { src })
    assert.match(campaignDesignIssue(design)!, /HTTPS/)
  }
})
test('empty, oversized, and invalid-style designs are blocked before silent normalization', () => {
  assert.match(campaignDesignIssue({ ...valid(), blocks: [] })!, /en az bir/)
  assert.match(campaignDesignIssue({ ...valid(), blocks: Array(41).fill(valid().blocks[0]) })!, /40/)
  assert.match(campaignDesignIssue({ ...valid(), accentColor: '#12' })!, /Renk/)
  assert.match(campaignDesignIssue({ ...valid(), maxWidth: 0 })!, /480/)
})
