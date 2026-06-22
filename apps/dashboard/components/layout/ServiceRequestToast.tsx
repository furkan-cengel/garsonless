'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { I } from '../../lib/ui'

interface Props {
  tableLabel: string | null
  onDismiss: () => void
}

export default function ServiceRequestToast({ tableLabel, onDismiss }: Props) {
  useEffect(() => {
    if (!tableLabel) return
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [tableLabel, onDismiss])

  return (
    <AnimatePresence>
      {tableLabel && (
        <motion.div
          initial={{ opacity: 0, y: -56, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -56, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          style={{
            position: 'fixed', top: 16, left: '50%',
            zIndex: 200, width: 320,
            background: 'var(--night, #1a1612)', color: '#fff',
            borderRadius: 14,
            boxShadow: '0 20px 60px -12px rgba(0,0,0,.55)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,159,64,.2)', color: '#ffb86b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><I.bell size={18} strokeWidth={2} /></div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Garson çağrısı</p>
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,.6)', margin: '2px 0 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {tableLabel} garson çağırıyor
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              border: 'none', background: 'rgba(255,255,255,.1)',
              color: 'rgba(255,255,255,.7)', fontSize: 16,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0,
            }}
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
