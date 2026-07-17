'use client'

import { AppIcons } from '@garsonless/ui/icons'
import type { QRConfig, QRHealth } from './tables-builder-types'

interface QRHealthDialogProps {
  open: boolean
  health: QRHealth
  qr: QRConfig
  onClose: () => void
}

export function QRHealthDialog({ open, health, qr, onClose }: QRHealthDialogProps) {
  if (!open || health.state !== 'invalid') return null

  return (
    <div
      role="presentation"
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(17,17,19,.42)', backdropFilter: 'blur(3px)' }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="qr-health-title"
        aria-describedby="qr-health-description"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: 'min(480px, 100%)', overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(165,90,0,.22)', background: 'var(--surface)', boxShadow: '0 28px 80px rgba(17,17,19,.24)' }}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg, #d97706, #f0b44d)' }} />
        <div style={{ padding: '20px 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
            <div aria-hidden="true" style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center', color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid rgba(165,90,0,.13)' }}>
              <AppIcons.warn size={21} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ padding: '2px 7px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 10, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase' }}>Okunabilirlik</span>
                <span style={{ fontSize: 10.5, color: 'var(--positive)', fontWeight: 600 }}>Stil kaydedildi</span>
              </div>
              <div id="qr-health-title" style={{ fontSize: 17, fontWeight: 750, letterSpacing: '-.015em', color: 'var(--text)' }}>QR kodu güvenli okuma eşiğinin altında</div>
              <div id="qr-health-description" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-2)' }}>
                Bazı telefon kameraları bu tasarımı okumakta zorlanabilir. Baskıya almadan önce birkaç ayarı sadeleştirmenizi öneriyoruz.
              </div>
            </div>
            <button type="button" className="tb-hover" aria-label="Uyarıyı kapat" onClick={onClose} style={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer' }}>
              <AppIcons.x size={14} />
            </button>
          </div>
          <div style={{ marginTop: 17, padding: '4px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {health.contrast < 4 && <HealthSuggestion>Ön plan ve arka plan arasındaki renk farkını artırın.</HealthSuggestion>}
            {qr.logoSize > .36 && <HealthSuggestion>Logoyu küçültün veya çevresindeki boşluğu artırın.</HealthSuggestion>}
            {['dots', 'classy', 'classy-rounded'].includes(qr.dotsType) && <HealthSuggestion>Modül şeklini Kare veya Yuvarlak olarak sadeleştirin.</HealthSuggestion>}
            {['L', 'M'].includes(qr.ecl) && <HealthSuggestion>Hata düzeltme seviyesini Q (%25) veya H (%30) yapın.</HealthSuggestion>}
            {qr.margin < 16 && <HealthSuggestion>Kameranın sınırı ayırabilmesi için kenar boşluğunu artırın.</HealthSuggestion>}
            <HealthSuggestion last>Sonucun üst barda yeşile dönmesini bekleyin.</HealthSuggestion>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Değişiklikler otomatik kaydedilir</span>
          <button type="button" className="tb-hover" onClick={onClose} style={{ height: 34, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--text)', borderRadius: 7, background: 'var(--text)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Ayarlara dön
          </button>
        </div>
      </div>
    </div>
  )
}

function HealthSuggestion({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', borderBottom: last ? 'none' : '1px solid var(--divider)', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.45 }}>
      <span aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)' }}>
        <AppIcons.chevRight size={11} strokeWidth={2.4} />
      </span>
      <span>{children}</span>
    </div>
  )
}
