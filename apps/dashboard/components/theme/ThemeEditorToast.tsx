'use client'

import { useEffect } from 'react'
import { Toaster, toast } from '@/components/ui/toast'

interface ThemeEditorToastProps {
  message: string
}

export function ThemeEditorToast({ message }: ThemeEditorToastProps) {
  useEffect(() => {
    if (!message) return
    toast.add({ title: message, type: 'info', timeout: 3200 })
  }, [message])

  return <Toaster />
}
