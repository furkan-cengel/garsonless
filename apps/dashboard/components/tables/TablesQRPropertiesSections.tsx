'use client'

import React from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import type { QRConfig, TableItem } from './tables-builder-types'
import type { QRPropertiesTab, SetQRField } from './use-tables-qr-properties-model'
import { TablesQRLogoSection } from './TablesQRLogoSection'
import {
  ColorField,
  DotPreview,
  EyeBallPreview,
  EyeFramePreview,
  Field,
  FramePreview,
  Group,
  MONO_STYLE,
  Segmented,
  Slider,
  StylePicker,
  Swatches,
  TextInput,
  Toggle,
} from './tables-qr-property-controls'

const DOT_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dots', label: 'Nokta' },
  { value: 'rounded', label: 'Yuvarlak' },
  { value: 'classy', label: 'Klasik' },
  { value: 'classy-rounded', label: 'Klasik+' },
  { value: 'extra-rounded', label: 'Çok yuvarlak' },
]
const EYE_FRAME_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dot', label: 'Nokta' },
  { value: 'extra-rounded', label: 'Yuvarlak' },
]
const EYE_BALL_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dot', label: 'Nokta' },
]
const FRAME_STYLES = [
  { id: 'none', label: 'Yok' },
  { id: 'card', label: 'Kart' },
  { id: 'banner', label: 'Şerit' },
  { id: 'speech', label: 'Balon' },
  { id: 'phone', label: 'Telefon' },
]

function ShapeSection({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Modül şekli" defaultOpen>
        <StylePicker label="QR modül şekli" value={qr.dotsType} onChange={value => set('dotsType', value)} options={DOT_STYLES} renderPreview={kind => <DotPreview kind={kind} />} />
      </Group>
      <Group title="Göz çerçevesi">
        <StylePicker label="QR göz çerçevesi" value={qr.eyeFrame} onChange={value => set('eyeFrame', value)} options={EYE_FRAME_STYLES} renderPreview={kind => <EyeFramePreview kind={kind} />} />
      </Group>
      <Group title="Göz merkezi">
        <StylePicker label="QR göz merkezi" value={qr.eyeBall} onChange={value => set('eyeBall', value)} options={EYE_BALL_STYLES} renderPreview={kind => <EyeBallPreview kind={kind} />} />
      </Group>
      <Group title="Genel" defaultOpen={false}>
        <Field label="Boyut"><Slider value={qr.size} min={200} max={1200} step={50} onBegin={() => set('size', qr.size, 'begin')} onChange={(value, transient) => set('size', value, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Kenar boşluğu"><Slider value={qr.margin} min={0} max={40} onBegin={() => set('margin', qr.margin, 'begin')} onChange={(value, transient) => set('margin', value, transient ? 'replace' : 'push')} suffix="px" /></Field>
        <Field label="Hata düzeltme" hint="Logo varsa H önerilir">
          <Segmented value={qr.ecl} onChange={value => set('ecl', value)} options={[
            { value: 'L', label: 'L · %7' },
            { value: 'M', label: 'M · %15' },
            { value: 'Q', label: 'Q · %25' },
            { value: 'H', label: 'H · %30' },
          ]} />
        </Field>
      </Group>
    </>
  )
}

function ColorSection({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Renk türü">
        <Segmented value={qr.colorType} onChange={value => set('colorType', value)} options={[
          { value: 'single', label: 'Tek' },
          { value: 'gradient', label: 'Gradyan' },
        ]} />
      </Group>
      <Group title="Ön plan">
        <Field label="Renk 1"><ColorField value={qr.fg} onChange={value => set('fg', value)} /></Field>
        {qr.colorType === 'gradient' && <>
          <Field label="Renk 2"><ColorField value={qr.fg2} onChange={value => set('fg2', value)} /></Field>
          <Field label="Tip">
            <Segmented value={qr.gradType} onChange={value => set('gradType', value)} options={[
              { value: 'linear', label: 'Doğrusal' },
              { value: 'radial', label: 'Dairesel' },
            ]} />
          </Field>
          {qr.gradType === 'linear' && (
            <Field label="Açı"><Slider value={qr.gradAngle} min={0} max={360} step={15} onBegin={() => set('gradAngle', qr.gradAngle, 'begin')} onChange={(value, transient) => set('gradAngle', value, transient ? 'replace' : 'push')} suffix="°" /></Field>
          )}
        </>}
        <div style={{ marginTop: 4 }}><Swatches label="Hazır ön plan renkleri" value={qr.fg} onChange={value => set('fg', value)} options={['#111113', '#a13b7a', '#2f6f4e', '#b8551c', '#1f4e8f', '#0e0e10']} /></div>
      </Group>
      <Group title="Arka plan">
        <Field label="Renk"><ColorField value={qr.bg} onChange={value => set('bg', value)} /></Field>
        <Field label="Şeffaf"><Toggle on={qr.bgTransparent} onChange={value => set('bgTransparent', value)} /></Field>
        <div style={{ marginTop: 4 }}><Swatches label="Hazır arka plan renkleri" value={qr.bg} onChange={value => set('bg', value)} options={['#ffffff', '#fdf6ec', '#eaf3ed', '#fff6ef', '#f3f3f5', '#e7eef8']} /></div>
      </Group>
    </>
  )
}

function FrameSection({ qr, set }: { qr: QRConfig; set: SetQRField }) {
  return (
    <>
      <Group title="Çerçeve stili" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {FRAME_STYLES.map(frame => (
            <button key={frame.id} type="button" aria-pressed={qr.frame === frame.id} onClick={() => set('frame', frame.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              minHeight: 72, padding: '12px 6px 8px', cursor: 'pointer',
              background: qr.frame === frame.id ? 'var(--surface)' : 'var(--surface-2)',
              border: `1px solid ${qr.frame === frame.id ? 'var(--text)' : 'var(--border)'}`,
              borderRadius: 8, boxShadow: qr.frame === frame.id ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
            }}>
              <FramePreview kind={frame.id} />
              <span style={{ fontSize: 11, fontWeight: 500, color: qr.frame === frame.id ? 'var(--text)' : 'var(--text-2)' }}>{frame.label}</span>
            </button>
          ))}
        </div>
      </Group>
      <Group title="Etiket">
        <Field label="Başlık"><TextInput value={qr.frameTitle} onChange={value => set('frameTitle', value)} placeholder="Menüyü tara" /></Field>
        <Field label="Alt yazı"><TextInput value={qr.frameSubtitle} onChange={value => set('frameSubtitle', value)} placeholder="QR'ı telefon kameranızla okutun" /></Field>
        <Field label="Renk"><ColorField value={qr.frameColor} onChange={value => set('frameColor', value)} /></Field>
      </Group>
    </>
  )
}

function DataSection({ qr, set, tables }: { qr: QRConfig; set: SetQRField; tables: TableItem[] }) {
  const exampleTableId = tables[0]?.id ?? '{benzersiz-kimlik}'
  return (
    <>
      <Group title="Bağlantı">
        <Field label="Menü adresi" hint="Her masa için benzersiz, tahmin edilemez bir bağlantı oluşturulur">
          <div style={{
            minHeight: 34, display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 9px', border: '1px solid var(--divider)', borderRadius: 6,
            background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 12,
          }}>
            {React.cloneElement(AppIconNodes.link2 as React.ReactElement<{ size?: number }>, { size: 13 })}
            <span style={MONO_STYLE}>{qr.baseUrl}</span>
          </div>
        </Field>
        <div style={{
          marginTop: 6, padding: '8px 10px', background: 'var(--surface-2)',
          border: '1px solid var(--divider)', borderRadius: 6,
          fontSize: 11, color: 'var(--text-2)', ...MONO_STYLE,
        }}>Örnek: {qr.baseUrl}/table/{exampleTableId}</div>
      </Group>
      <Group title="UTM parametreleri" defaultOpen={false}>
        <Field label="Kaynak"><TextInput value={qr.utmSource} onChange={value => set('utmSource', value)} placeholder="qr" /></Field>
        <Field label="Medya"><TextInput value={qr.utmMedium} onChange={value => set('utmMedium', value)} placeholder="masa" /></Field>
        <Field label="Kampanya"><TextInput value={qr.utmCampaign} onChange={value => set('utmCampaign', value)} /></Field>
      </Group>
    </>
  )
}

export function TablesQRPropertiesSection({ tab, qr, set, tables, legacyLogoRejected }: {
  tab: QRPropertiesTab
  qr: QRConfig
  set: SetQRField
  tables: TableItem[]
  legacyLogoRejected: boolean
}) {
  if (tab === 'shape') return <ShapeSection qr={qr} set={set} />
  if (tab === 'color') return <ColorSection qr={qr} set={set} />
  if (tab === 'logo') return <TablesQRLogoSection qr={qr} set={set} legacyLogoRejected={legacyLogoRejected} />
  if (tab === 'frame') return <FrameSection qr={qr} set={set} />
  return <DataSection qr={qr} set={set} tables={tables} />
}
