'use client'

import { motion } from 'framer-motion'

interface AIChatBubbleProps {
  personaName?: string
  isOpen: boolean
  hasUnread?: boolean
  onClick: () => void
  bottomOffset?: number
}

export function AIChatBubble({
  personaName = 'AI',
  isOpen,
  hasUnread = false,
  onClick,
  bottomOffset = 24,
}: AIChatBubbleProps) {
  return (
    <motion.button
      aria-label={`${personaName} ile konuş`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        position: 'fixed',
        bottom: bottomOffset,
        right: 20,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hasUnread && !isOpen
          ? '0 0 0 4px rgba(161,59,122,0.2), 0 10px 30px rgba(0,0,0,0.2)'
          : '0 10px 30px rgba(0,0,0,0.2)',
        backgroundColor: 'var(--color-primary)',
        filter: isOpen ? 'brightness(0.9)' : undefined,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        animation: hasUnread && !isOpen ? 'pulse-soft 2s ease-in-out infinite' : 'none',
      }}
    >
      {/* Pulsing ring — only when closed and no unread */}
      {!isOpen && !hasUnread && (
        <motion.span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
          }}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* X icon when open, chat icon when closed */}
      {isOpen ? (
        <svg
          width={24}
          height={24}
          style={{ color: 'var(--color-background)', position: 'relative', zIndex: 10, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg
          width={24}
          height={24}
          style={{ color: 'var(--color-background)', position: 'relative', zIndex: 10, flexShrink: 0 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      )}

      {/* Unread badge */}
      {hasUnread && !isOpen && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '2px solid var(--color-background)',
            backgroundColor: 'var(--color-accent)',
          }}
        />
      )}
    </motion.button>
  )
}
