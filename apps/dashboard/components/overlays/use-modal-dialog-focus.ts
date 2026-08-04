'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')
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

/** Keeps keyboard focus inside an open modal and restores it to its opener. */
export function useModalDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (!dialog) return
    const dialogElement = dialog
    const previousOverflow = document.body.style.overflow
    const restoreInert = makeBackgroundInert(dialog)
    document.body.style.overflow = 'hidden'

    const initialFocus = dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')
      ?? focusableElements(dialog)[0]
      ?? dialog
    const focusFrame = window.requestAnimationFrame(() => initialFocus.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = focusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement
      if (!dialog.contains(active)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (event.target instanceof Node && !dialogElement.contains(event.target)) initialFocus.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      document.body.style.overflow = previousOverflow
      restoreInert()
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return dialogRef
}
