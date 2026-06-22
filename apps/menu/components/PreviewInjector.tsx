'use client'

import { useEffect } from 'react'

export default function PreviewInjector() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'GARSONLESS_THEME') return
      const css = event.data.css as string
      let style = document.getElementById('garsonless-preview') as HTMLStyleElement | null
      if (!style) {
        style = document.createElement('style')
        style.id = 'garsonless-preview'
        document.head.appendChild(style)
      }
      style.textContent = css
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return null
}
