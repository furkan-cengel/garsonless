import { MI } from '../lib/icons'
import { SectionHead } from './ui/SectionHead'

const rows = [
  { feature: 'QR menü',                     garson: true,     adisyo: true,     pos: true,     zenchef: true },
  { feature: 'Self-service sipariş',         garson: true,     adisyo: false,    pos: 'opt',    zenchef: false },
  { feature: 'Canlı mutfak ekranı',          garson: true,     adisyo: false,    pos: true,     zenchef: false },
  { feature: 'QR stüdyosu (özel tasarım)',   garson: true,     adisyo: false,    pos: false,    zenchef: false },
  { feature: 'Tema özelleştirme',            garson: 'full',   adisyo: 'lim',    pos: false,    zenchef: 'lim' },
  { feature: 'Çoklu dil (4+)',               garson: true,     adisyo: false,    pos: 'opt',    zenchef: true },
  { feature: 'AI içgörüler',                 garson: true,     adisyo: false,    pos: false,    zenchef: false },
  { feature: 'Türkçe destek',                garson: true,     adisyo: true,     pos: 'lim',    zenchef: false },
  { feature: 'Sipariş başı komisyon',        garson: 'no',     adisyo: 'no',     pos: 'no',     zenchef: '0.5%' },
  { feature: 'Aylık başlangıç ücreti',       garson: '₺0',     adisyo: '₺499',   pos: '₺899',   zenchef: '€89' },
]

type CellValue = boolean | 'opt' | 'lim' | 'full' | 'no' | string

function CompareCell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  let content: React.ReactNode
  if (value === true) content = <span style={{ color: 'var(--positive)' }}><MI.check size={18} /></span>
  else if (value === false) content = <span style={{ color: 'var(--ink-4)' }}><MI.x size={16} /></span>
  else if (value === 'opt') content = <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Opsiyonel</span>
  else if (value === 'lim') content = <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>Sınırlı</span>
  else if (value === 'full') content = <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 700 }}>Tam</span>
  else if (value === 'no') content = <span style={{ fontSize: 11, color: 'var(--positive)', fontWeight: 600 }}>Yok</span>
  else content = <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, fontWeight: highlight ? 700 : 500 }}>{value}</span>

  return (
    <div style={{ padding: '14px 14px', textAlign: 'center', borderLeft: '1px solid var(--line)', background: highlight ? 'rgba(255,208,137,.15)' : 'transparent' }}>
      {content}
    </div>
  )
}

export function IntegrationsSection() {
  return (
    <section style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div className="container">
        <SectionHead
          eyebrow="Kıyaslama"
          title={<>Neden <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>masabu?</em></>}
          sub="Tüm rakiplerin yapabildiğini yapar — ve fazlasını."
        />
        <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'var(--night)', color: '#fff' }}>
            <div style={{ padding: '18px 22px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Özellik</div>
            <div style={{ padding: '18px 14px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.08)', background: 'var(--accent-2)', color: 'var(--ink)' }}>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>masabu</div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, opacity: .75 }}>Bizim ürün</div>
            </div>
            {['Adisyo', 'Klasik POS', 'Zenchef'].map((h) => (
              <div key={h} style={{ padding: '18px 14px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,.08)', fontSize: 14, fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderTop: '1px solid var(--line)', background: i % 2 === 1 ? 'var(--bg-2)' : 'transparent' }}>
              <div style={{ padding: '14px 22px', fontSize: 14, fontWeight: 500 }}>{r.feature}</div>
              <CompareCell value={r.garson} highlight />
              <CompareCell value={r.adisyo} />
              <CompareCell value={r.pos} />
              <CompareCell value={r.zenchef} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
