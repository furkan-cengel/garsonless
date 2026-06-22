import { makeReaders, customSectionShell } from '../lib/sectionHelpers'

export function ChefPickSection({ config }: { config: Record<string, string> }) {
  const { text, number, targetHref } = makeReaders(config)
  const dishes = [
    { icon: '🥘', name: text('dish1Name', 'Hünkar Beğendi'), price: text('dish1Price', '280'), tag: 'İmza' },
    { icon: '🍖', name: text('dish2Name', 'Kuzu Tandır'), price: text('dish2Price', '420'), tag: 'Favori' },
    { icon: '🐟', name: text('dish3Name', 'Levrek Buğulama'), price: text('dish3Price', '360'), tag: '' },
  ]
  return (
    <section data-component="custom-section" style={customSectionShell}>
      <div style={{
        borderRadius: number('radius', 18),
        background: text('bgColor', '#1a1612'),
        color: '#fff',
        padding: 16,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 99,
            background: 'linear-gradient(135deg, #ffd089, #d97757)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            flexShrink: 0,
            boxShadow: '0 4px 14px -4px rgba(255,208,137,.5)',
          }}>👨‍🍳</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: text('accentColor', '#ffd089'), fontWeight: 700, letterSpacing: '.15em' }}>
              {text('eyebrow', "★ ŞEF'İN SEÇİMİ ★")}
            </div>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontStyle: 'italic', fontWeight: 500, color: text('textColor', '#ffffff'), marginTop: 2 }}>
              {text('title', 'Şef Murat Demir')}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>
              {text('body', '20 yıllık mutfak tecrübesi')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dishes.map((dish, index) => (
            <div key={`${dish.name}-${index}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: 10,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(255,208,137,.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}>
                {dish.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.name}</span>
                  {dish.tag && <span style={{ fontSize: 9, fontWeight: 700, padding: '1.5px 6px', borderRadius: 99, background: text('accentColor', '#ffd089'), color: text('bgColor', '#1a1612'), flexShrink: 0 }}>{dish.tag}</span>}
                </div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 13, fontStyle: 'italic', color: text('accentColor', '#ffd089'), marginTop: 2 }}>
                  ₺{dish.price.replace(/^₺/, '')}
                </div>
              </div>
              <a href={targetHref()} style={{ width: 30, height: 30, borderRadius: 99, background: text('accentColor', '#ffd089'), color: text('bgColor', '#1a1612'), display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, lineHeight: 1, textDecoration: 'none' }}>+</a>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5, color: 'rgba(255,255,255,.4)', fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif' }}>
          "Her tabak, bir hikaye anlatır."
        </div>
      </div>
    </section>
  )
}
