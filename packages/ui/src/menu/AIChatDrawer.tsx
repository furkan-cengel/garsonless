'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DotsSpinner } from '../spinners'

export interface ToolChip {
  id: string
  name: string
  label: string
  status: 'pending' | 'done' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolChips?: ToolChip[]
}

interface AIChatDrawerProps {
  isOpen: boolean
  personaName?: string
  messages: ChatMessage[]
  isLoading: boolean
  onClose: () => void
  onSend: (text: string) => void
  inputValue: string
  onInputChange: (value: string) => void
  bottomOffset?: number
}

function ToolChipBadge({ chip }: { chip: ToolChip }) {
  const statusColor =
    chip.status === 'done'
      ? 'var(--color-accent)'
      : chip.status === 'error'
        ? '#ef4444'
        : 'var(--color-text-muted)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        marginTop: 4,
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${statusColor}`,
        color: statusColor,
      }}
    >
      {chip.status === 'pending' && (
        <motion.span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            display: 'inline-block',
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      {chip.label}
    </span>
  )
}

export function AIChatDrawer({
  isOpen,
  personaName = 'AI Garson',
  messages,
  isLoading,
  onClose,
  onSend,
  inputValue,
  onInputChange,
  bottomOffset = 96,
}: AIChatDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
      e.preventDefault()
      onSend(inputValue.trim())
    }
  }

  function handleSendClick() {
    if (inputValue.trim()) onSend(inputValue.trim())
  }

  const sendDisabled = isLoading || !inputValue.trim()

  const panelStyle = isMobile
    ? {
        position: 'fixed' as const,
        bottom: bottomOffset,
        left: 12,
        right: 12,
        height: 480,
        borderRadius: 16,
      }
    : {
        position: 'fixed' as const,
        bottom: bottomOffset,
        right: 16,
        width: 360,
        height: 520,
        borderRadius: 16,
      }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Partial backdrop — dims but doesn't fully block */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 48,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />

          <motion.div
          style={{
            ...panelStyle,
            zIndex: 49,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
            transformOrigin: 'bottom right',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Header */}
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.08))',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-background)',
                  flexShrink: 0,
                }}
              >
                {personaName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
                  {personaName}
                </p>
                <p style={{ fontSize: 11, margin: 0, color: 'var(--color-text-muted)' }}>
                  AI Garson
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                flexShrink: 0,
              }}
              aria-label="Küçült"
            >
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 12,
                  textAlign: 'center',
                  padding: '0 24px',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-background)',
                  }}
                >
                  ✨
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--color-text)' }}>
                  Merhaba! Menü hakkında ne sormak istersiniz?
                </p>
                <p style={{ fontSize: 12, margin: 0, color: 'var(--color-text-muted)' }}>
                  Öneri isteyebilir, içerik sorabilir veya sipariş verebilirsiniz.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={
                      msg.role === 'user'
                        ? {
                            padding: '10px 14px',
                            borderRadius: 16,
                            borderBottomRightRadius: 4,
                            fontSize: 14,
                            lineHeight: 1.5,
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-background)',
                          }
                        : {
                            padding: '10px 14px',
                            borderRadius: 16,
                            borderBottomLeftRadius: 4,
                            fontSize: 14,
                            lineHeight: 1.5,
                            backgroundColor: 'var(--color-background)',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                          }
                    }
                  >
                    {msg.text || (msg.role === 'assistant' && msg.toolChips?.length ? '' : '…')}
                  </div>

                  {msg.toolChips && msg.toolChips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {msg.toolChips.map((chip) => (
                        <ToolChipBadge key={chip.id} chip={chip} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 16,
                    borderBottomLeftRadius: 4,
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                  }}
                >
                  <DotsSpinner color="var(--color-text-muted)" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bir şeyler sorun…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  fontSize: 13,
                  outline: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  minWidth: 0,
                }}
                disabled={isLoading}
              />

              <button
                onClick={handleSendClick}
                disabled={sendDisabled}
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 150ms',
                  opacity: sendDisabled ? 0.3 : 1,
                  cursor: sendDisabled ? 'not-allowed' : 'pointer',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-background)',
                  border: 'none',
                  padding: 0,
                }}
                aria-label="Gönder"
              >
                <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
