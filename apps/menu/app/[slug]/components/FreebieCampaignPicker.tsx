'use client'
import { useMenuLocale } from '@garsonless/ui/menu/MenuLocaleContext'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import type { FreebieAddRequest } from '@garsonless/ui/themes'
import type { MenuItem } from '@garsonless/ui/menu'
import { AppIcons as I } from '@garsonless/ui/icons'

export function FreebieCampaignPicker({ campaign, qualifier, onClose, onChoose }: {
  campaign: FreebieAddRequest | null
  qualifier?: MenuItem | null
  onClose: () => void
  onChoose: (qualifier: MenuItem, reward: MenuItem) => void
}) {
  const { t, text } = useMenuLocale()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  const [selectedQualifierId, setSelectedQualifierId] = useState(qualifier?.id ?? '')
  const [selectedRewardId, setSelectedRewardId] = useState(campaign?.rewardItems.length === 1 ? campaign.rewardItems[0]?.id ?? '' : '')

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    setSelectedQualifierId(qualifier?.id ?? '')
    setSelectedRewardId(campaign?.rewardItems.length === 1 ? campaign.rewardItems[0]?.id ?? '' : '')
    if (!campaign) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [campaign, qualifier?.id])

  if (!campaign) return null
  const selectedQualifier = qualifier ?? campaign.qualifierItems.find((item) => item.id === selectedQualifierId) ?? null
  const selectedReward = campaign.rewardItems.find((item) => item.id === selectedRewardId) ?? null

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 170, padding: 16, display: 'grid', alignItems: 'end', background: 'rgba(15,23,42,.58)', backdropFilter: 'blur(5px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} data-component="freebie-campaign-picker" style={{ width: 'min(100%, 560px)', maxHeight: 'min(78dvh, 720px)', margin: '0 auto', padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', overflowY: 'auto', borderRadius: '24px 24px 18px 18px', background: 'var(--p-card)', color: 'var(--p-text)', boxShadow: '0 28px 70px rgba(15,23,42,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'var(--p-accent-soft)', color: 'var(--p-accent)' }}><I.gift size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}><small style={{ color: 'var(--p-accent)', fontSize: 10, fontWeight: 850, letterSpacing: '.08em' }}>{t("KAMPANYA HEDİYESİ")}</small><h2 id={titleId} style={{ margin: '3px 0 0', fontFamily: 'var(--p-body)', fontSize: 20, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-.01em' }}>{text(`theme/section/${campaign.sectionInstanceId}/freebieTitle`, campaign.title)}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("Hediye seçimini kapat")} style={{ width: 44, height: 44, border: 0, borderRadius: 999, background: 'var(--p-accent-soft)', color: 'var(--p-text)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><I.close size={18} /></button>
        </div>

        {!qualifier && <ChoiceGrid title="Önce uygun ürünü seç" items={campaign.qualifierItems} selectedId={selectedQualifierId} onSelect={setSelectedQualifierId} />}
        <ChoiceGrid title="Hediyeni seç" items={campaign.rewardItems} selectedId={selectedRewardId} onSelect={setSelectedRewardId} free />

        <button type="button" disabled={!selectedQualifier || !selectedReward} onClick={() => { if (selectedQualifier && selectedReward) onChoose(selectedQualifier, selectedReward) }} style={{ width: '100%', minHeight: 52, marginTop: 16, border: 0, borderRadius: 15, background: selectedQualifier && selectedReward ? 'var(--p-cta)' : 'var(--p-border)', color: selectedQualifier && selectedReward ? 'var(--p-cta-text)' : 'var(--p-text-2)', font: '850 14px var(--p-body)', cursor: selectedQualifier && selectedReward ? 'pointer' : 'not-allowed' }}>{t("Seçimleri tamamla")}</button>
      </section>
    </div>
  )
}

function ChoiceGrid({ title, items, selectedId, onSelect, free = false }: { title: string; items: MenuItem[]; selectedId: string; onSelect: (id: string) => void; free?: boolean }) {
  const menuLocale = useMenuLocale()
  const { t } = menuLocale
  return <fieldset style={{ minWidth: 0, margin: '18px 0 0', padding: 0, border: 0 }}><legend style={{ marginBottom: 9, fontSize: 12.5, fontWeight: 800 }}>{t(title)}</legend><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9 }}>{items.map((item) => {
    const selected = item.id === selectedId
    return <button key={item.id} type="button" aria-pressed={selected} onClick={() => onSelect(item.id)} style={{ minHeight: 74, padding: 8, border: selected ? '2px solid var(--p-accent)' : '1px solid var(--p-border)', borderRadius: 14, background: selected ? 'var(--p-accent-soft)' : 'var(--p-bg)', color: 'var(--p-text)', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', cursor: 'pointer' }}>{item.images[0] ? <Image src={item.images[0]} alt="" width={54} height={54} unoptimized style={{ width: 54, height: 54, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 54, height: 54, borderRadius: 11, background: 'var(--p-card)', display: 'grid', placeItems: 'center', color: 'var(--p-text-2)', flexShrink: 0 }}><I.image size={18} /></span>}<span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{menuLocale.item(item).name}</strong><small style={{ display: 'block', marginTop: 4, color: free ? 'var(--p-accent)' : 'var(--p-text-2)', fontWeight: 800 }}>{free ? t('Hediye · ₺0') : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.price)}</small></span></button>
  })}</div></fieldset>
}
