'use client'

interface ThemeEditorToastProps {
  message: string
}

export function ThemeEditorToast({ message }: ThemeEditorToastProps) {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--text)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  )
}
