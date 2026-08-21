'use client'

import { useEffect, useState } from 'react'
import {
  createSetMenuCartPreviewStateCommand,
  type MenuCartPreviewState,
  type ThemePreviewCommand,
} from '@garsonless/design-engine'

export function useThemeEditorCartPreview({
  activeGroup,
  previewStatus,
  postPreviewMessage,
}: {
  activeGroup: string
  previewStatus: string
  postPreviewMessage: (message: ThemePreviewCommand | null) => void
}) {
  const [cartPreviewState, setCartPreviewState] = useState<MenuCartPreviewState>('trigger')
  useEffect(() => {
    if (previewStatus !== 'ready') return
    postPreviewMessage(createSetMenuCartPreviewStateCommand(activeGroup === 'cart' ? cartPreviewState : null))
  }, [activeGroup, cartPreviewState, postPreviewMessage, previewStatus])
  return { cartPreviewState, setCartPreviewState }
}
