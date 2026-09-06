'use client'

import type {
  CampaignEmailAlignment,
  CampaignEmailBlock,
  CampaignEmailDesign,
  CampaignEmailFontFamily,
} from '@garsonless/domain/campaigns'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const BLOCKS: Array<{ type: CampaignEmailBlock['type']; label: string }> = [
  { type: 'heading', label: 'Başlık' },
  { type: 'text', label: 'Metin' },
  { type: 'image', label: 'Görsel' },
  { type: 'button', label: 'Buton' },
  { type: 'grid', label: 'Grid' },
  { type: 'divider', label: 'Ayraç' },
  { type: 'spacer', label: 'Boşluk' },
]

function id(): string {
  return crypto.randomUUID()
}

function newBlock(type: CampaignEmailBlock['type'], accent: string, textColor: string): CampaignEmailBlock {
  if (type === 'heading') return { id: id(), type, text: 'Yeni başlık', level: 2, align: 'left', color: textColor }
  if (type === 'text') return { id: id(), type, text: 'Metninizi buraya yazın.', align: 'left', color: textColor, fontSize: 16 }
  if (type === 'image') return { id: id(), type, src: '', alt: 'Kampanya görseli', href: '', borderRadius: 12 }
  if (type === 'button') return { id: id(), type, label: 'İncele', href: '', align: 'center', backgroundColor: accent, textColor: '#ffffff', borderRadius: 10 }
  if (type === 'divider') return { id: id(), type, color: '#e5e5e7', thickness: 1 }
  if (type === 'spacer') return { id: id(), type, height: 24 }
  return {
    id: id(), type: 'grid', columns: 2,
    items: [
      { title: 'Birinci öğe', text: 'Kısa açıklama', imageUrl: '', href: '' },
      { title: 'İkinci öğe', text: 'Kısa açıklama', imageUrl: '', href: '' },
    ],
  }
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
        <Input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 p-1" aria-label={`${label} renk seçici`} />
        <Input value={value} onChange={(event) => onChange(event.target.value)} maxLength={7} aria-label={`${label} renk kodu`} className="font-mono text-xs" />
      </div>
    </Field>
  )
}

function AlignmentControl({ value, onChange }: { value: CampaignEmailAlignment; onChange: (value: CampaignEmailAlignment) => void }) {
  return (
    <Field>
      <FieldLabel>Hizalama</FieldLabel>
      <Select value={value} onValueChange={(next) => onChange((next || 'left') as CampaignEmailAlignment)}>
        <SelectTrigger className="w-full" aria-label="Hizalama"><SelectValue>{({ left: 'Sol', center: 'Orta', right: 'Sağ' })[value]}</SelectValue></SelectTrigger>
        <SelectContent><SelectItem value="left">Sol</SelectItem><SelectItem value="center">Orta</SelectItem><SelectItem value="right">Sağ</SelectItem></SelectContent>
      </Select>
    </Field>
  )
}

export default function CampaignEmailBuilder({
  design,
  onChange,
}: {
  design: CampaignEmailDesign
  onChange: (design: CampaignEmailDesign) => void
}) {
  const patchDesign = (patch: Partial<CampaignEmailDesign>) => onChange({ ...design, ...patch })
  const patchBlock = (index: number, patch: Partial<CampaignEmailBlock>) => {
    const blocks = design.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } as CampaignEmailBlock : block)
    patchDesign({ blocks })
  }
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= design.blocks.length) return
    const blocks = [...design.blocks]
    const current = blocks[index]!
    blocks[index] = blocks[target]!
    blocks[target] = current
    patchDesign({ blocks })
  }

  return (
    <div className="campaign-email-builder">
      <Card className="campaign-email-theme p-3">
        <div className="mb-3 text-sm font-semibold">Genel stil</div>
        <div className="campaign-email-theme-grid grid grid-cols-2 gap-3">
          <ColorControl label="Sayfa" value={design.backgroundColor} onChange={(backgroundColor) => patchDesign({ backgroundColor })} />
          <ColorControl label="İçerik" value={design.contentBackgroundColor} onChange={(contentBackgroundColor) => patchDesign({ contentBackgroundColor })} />
          <ColorControl label="Metin" value={design.textColor} onChange={(textColor) => patchDesign({ textColor })} />
          <ColorControl label="Vurgu" value={design.accentColor} onChange={(accentColor) => patchDesign({ accentColor })} />
          <Field>
            <FieldLabel>Tipografi</FieldLabel>
            <Select value={design.fontFamily} onValueChange={(value) => patchDesign({ fontFamily: (value || 'arial') as CampaignEmailFontFamily })}>
              <SelectTrigger className="w-full" aria-label="Tipografi"><SelectValue>{({ arial: 'Arial', georgia: 'Georgia', trebuchet: 'Trebuchet', courier: 'Courier' })[design.fontFamily]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="arial">Arial</SelectItem><SelectItem value="georgia">Georgia</SelectItem>
                <SelectItem value="trebuchet">Trebuchet</SelectItem><SelectItem value="courier">Courier</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field><FieldLabel>İçerik genişliği</FieldLabel><Input type="number" min={480} max={720} aria-label="İçerik genişliği" value={design.maxWidth} onChange={(event) => patchDesign({ maxWidth: Number(event.target.value) })} /></Field>
          <Field><FieldLabel>Köşe yuvarlaklığı</FieldLabel><Input type="number" min={0} max={32} aria-label="Köşe yuvarlaklığı" value={design.borderRadius} onChange={(event) => patchDesign({ borderRadius: Number(event.target.value) })} /></Field>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="E-posta elementi ekle">
        {BLOCKS.map((item) => <Button key={item.type} type="button" variant="outline" size="xs" disabled={design.blocks.length >= 40} onClick={() => patchDesign({ blocks: [...design.blocks, newBlock(item.type, design.accentColor, design.textColor)] })}>+ {item.label}</Button>)}
      </div>
      <FieldDescription className="mt-2">Görseller için herkese açık HTTPS adresi kullanın. Elementler yukarı/aşağı düğmeleriyle sıralanır. En fazla 40 element eklenebilir.</FieldDescription>

      <div className="mt-3 grid gap-3" role="list" aria-label="E-posta elementleri">
        {design.blocks.map((block, index) => (
          <Card key={block.id} role="listitem" className="campaign-email-block p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong className="text-sm">{BLOCKS.find((item) => item.type === block.type)?.label}</strong>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="xs" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${index + 1}. elementi yukarı taşı`}>↑</Button>
                <Button type="button" variant="ghost" size="xs" disabled={index === design.blocks.length - 1} onClick={() => move(index, 1)} aria-label={`${index + 1}. elementi aşağı taşı`}>↓</Button>
                <Button type="button" variant="ghost" size="xs" onClick={() => patchDesign({ blocks: design.blocks.filter((_, blockIndex) => blockIndex !== index) })} aria-label={`${index + 1}. elementi sil`}>Sil</Button>
              </div>
            </div>

            {block.type === 'heading' && <div className="grid gap-3"><Field><FieldLabel>Başlık</FieldLabel><Input maxLength={300} aria-label="Metin" value={block.text} onChange={(event) => patchBlock(index, { text: event.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field><FieldLabel>Seviye</FieldLabel><Select value={String(block.level)} onValueChange={(value) => patchBlock(index, { level: value === '2' ? 2 : 1 })}><SelectTrigger className="w-full" aria-label="Başlık seviyesi"><SelectValue>{block.level === 2 ? 'Orta' : 'Büyük'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="1">Büyük</SelectItem><SelectItem value="2">Orta</SelectItem></SelectContent></Select></Field><AlignmentControl value={block.align} onChange={(align) => patchBlock(index, { align })} /></div><ColorControl label="Başlık rengi" value={block.color} onChange={(color) => patchBlock(index, { color })} /></div>}

            {block.type === 'text' && <div className="grid gap-3"><Field><FieldLabel>Metin</FieldLabel><Textarea maxLength={5000} aria-label="Metin" value={block.text} rows={4} onChange={(event) => patchBlock(index, { text: event.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><AlignmentControl value={block.align} onChange={(align) => patchBlock(index, { align })} /><Field><FieldLabel>Boyut</FieldLabel><Input type="number" min={12} max={24} aria-label="Yazı boyutu" value={block.fontSize} onChange={(event) => patchBlock(index, { fontSize: Number(event.target.value) })} /></Field></div><ColorControl label="Metin rengi" value={block.color} onChange={(color) => patchBlock(index, { color })} /></div>}

            {block.type === 'image' && <div className="grid gap-3"><Field><FieldLabel>Görsel URL</FieldLabel><Input type="url" maxLength={2000} aria-label="Görsel URL" value={block.src} placeholder="https://…" onChange={(event) => patchBlock(index, { src: event.target.value })} /></Field><Field><FieldLabel>Alternatif metin</FieldLabel><Input aria-label="Alternatif metin" value={block.alt} onChange={(event) => patchBlock(index, { alt: event.target.value })} /></Field><Field><FieldLabel>Tıklama bağlantısı</FieldLabel><Input type="url" maxLength={2000} aria-label="Bağlantı" value={block.href} placeholder="https://…" onChange={(event) => patchBlock(index, { href: event.target.value })} /></Field><Field><FieldLabel>Köşe yuvarlaklığı</FieldLabel><Input type="number" min={0} max={32} aria-label="Element köşe yuvarlaklığı" value={block.borderRadius} onChange={(event) => patchBlock(index, { borderRadius: Number(event.target.value) })} /></Field></div>}

            {block.type === 'button' && <div className="grid gap-3"><Field><FieldLabel>Buton metni</FieldLabel><Input maxLength={120} aria-label="Buton metni" value={block.label} onChange={(event) => patchBlock(index, { label: event.target.value })} /></Field><Field><FieldLabel>Bağlantı</FieldLabel><Input type="url" maxLength={2000} aria-label="Bağlantı" value={block.href} placeholder="https://…" onChange={(event) => patchBlock(index, { href: event.target.value })} /></Field><AlignmentControl value={block.align} onChange={(align) => patchBlock(index, { align })} /><div className="grid grid-cols-2 gap-3"><ColorControl label="Buton" value={block.backgroundColor} onChange={(backgroundColor) => patchBlock(index, { backgroundColor })} /><ColorControl label="Yazı" value={block.textColor} onChange={(textColor) => patchBlock(index, { textColor })} /></div></div>}

            {block.type === 'divider' && <div className="grid grid-cols-2 gap-3"><ColorControl label="Ayraç rengi" value={block.color} onChange={(color) => patchBlock(index, { color })} /><Field><FieldLabel>Kalınlık</FieldLabel><Input type="number" min={1} max={8} aria-label="Ayraç kalınlığı" value={block.thickness} onChange={(event) => patchBlock(index, { thickness: Number(event.target.value) })} /></Field></div>}
            {block.type === 'spacer' && <Field><FieldLabel>Yükseklik</FieldLabel><Input type="number" min={8} max={96} aria-label="Boşluk yüksekliği" value={block.height} onChange={(event) => patchBlock(index, { height: Number(event.target.value) })} /></Field>}

            {block.type === 'grid' && <div className="grid gap-3"><Field><FieldLabel>Kolon</FieldLabel><Select value={String(block.columns)} onValueChange={(value) => {
              const columns = value === '3' ? 3 : 2
              const items = [...block.items]
              while (items.length < columns) items.push({ title: `Öğe ${items.length + 1}`, text: 'Kısa açıklama', imageUrl: '', href: '' })
              patchBlock(index, { columns, items: items.slice(0, columns) })
            }}><SelectTrigger className="w-full" aria-label="Grid kolon sayısı"><SelectValue>{block.columns} kolon</SelectValue></SelectTrigger><SelectContent><SelectItem value="2">2 kolon</SelectItem><SelectItem value="3">3 kolon</SelectItem></SelectContent></Select></Field>{block.items.slice(0, block.columns).map((item, itemIndex) => <Card key={itemIndex} className="grid gap-2 bg-muted/30 p-2"><strong className="text-xs">{itemIndex + 1}. kart</strong><Input aria-label="Kart başlığı" value={item.title} placeholder="Başlık" onChange={(event) => patchBlock(index, { items: block.items.map((current, currentIndex) => currentIndex === itemIndex ? { ...current, title: event.target.value } : current) })} /><Textarea aria-label="Kart açıklaması" value={item.text} rows={2} placeholder="Açıklama" onChange={(event) => patchBlock(index, { items: block.items.map((current, currentIndex) => currentIndex === itemIndex ? { ...current, text: event.target.value } : current) })} /><Input type="url" maxLength={2000} aria-label="Kart görsel URL" value={item.imageUrl} placeholder="Görsel URL (https://…)" onChange={(event) => patchBlock(index, { items: block.items.map((current, currentIndex) => currentIndex === itemIndex ? { ...current, imageUrl: event.target.value } : current) })} /><Input type="url" maxLength={2000} aria-label="Kart bağlantısı" value={item.href} placeholder="Bağlantı (https://…)" onChange={(event) => patchBlock(index, { items: block.items.map((current, currentIndex) => currentIndex === itemIndex ? { ...current, href: event.target.value } : current) })} /></Card>)}</div>}
          </Card>
        ))}
      </div>
      <style>{`
        @media(max-width:560px){.campaign-email-theme-grid{grid-template-columns:1fr!important}.campaign-email-block .grid-cols-2{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}
