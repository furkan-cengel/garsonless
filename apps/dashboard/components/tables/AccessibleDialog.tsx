'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => (
    !element.closest('[inert]')
    && element.getAttribute('aria-hidden') !== 'true'
    && element.getClientRects().length > 0
  ))
}

function makeBackgroundInert(dialog: HTMLElement): () => void {
  const changed = new Map<HTMLElement, boolean>()
  let current: HTMLElement | null = dialog

  while (current?.parentElement) {
    const parent: HTMLElement = current.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === current || !(sibling instanceof HTMLElement) || changed.has(sibling)) continue
      changed.set(sibling, sibling.inert)
      sibling.inert = true
    }
    current = parent
    if (parent === document.body) break
  }

  return () => {
    for (const [element, wasInert] of changed) element.inert = wasInert
  }
}

export function AccessibleDialog({
  children,
  labelledBy,
  describedBy,
  onClose,
  closeDisabled = false,
  role = 'dialog',
  className,
  style,
}: {
  children: ReactNode
  labelledBy: string
  describedBy?: string
  onClose: () => void
  closeDisabled?: boolean
  role?: 'dialog' | 'alertdialog'
  className?: string
  style: CSSProperties
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  onCloseRef.current = onClose
  closeDisabledRef.current = closeDisabled

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const restoreInert = makeBackgroundInert(dialog)
    document.body.style.overflow = 'hidden'

    const focusInitial = () => {
      const preferred = dialog.querySelector<HTMLElement>('[data-modal-initial-focus]')
      const target = preferred && !preferred.matches(':disabled') ? preferred : focusableElements(dialog)[0]
      ;(target ?? dialog).focus()
    }
    const focusFrame = window.requestAnimationFrame(focusInitial)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeDisabledRef.current) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableElements(dialog)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
        return
      }
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusInitial()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.body.style.overflow = previousOverflow
      restoreInert()
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus()
    }
  }, [])

  return (
    <div
      ref={dialogRef}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={className}
      tabIndex={-1}
      style={{ ...style, outline: 'none' }}
      onMouseDown={(event) => {
        if (!closeDisabled && event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}
