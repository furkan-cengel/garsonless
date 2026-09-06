'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useShell } from '../../lib/shell-context'
import { toast } from '@/components/ui/toast'
import UnsavedChangesDialog from './UnsavedChangesDialog'
import { DraftRegistry } from './draft-registry'

const Context = createContext<{ registry: DraftRegistry; requestExit: (action: () => void) => void } | null>(null)

export function DashboardDraftProvider({ children, message }: { children: ReactNode; message: string }) {
  const [registry] = useState(() => new DraftRegistry())
  useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot)
  const [exit, setExit] = useState<(() => void) | null>(null)
  const { setNavigationGuard, setNavigationInterceptor, closeOverlay } = useShell()
  const requestExit = useCallback((action: () => void) => {
    if (registry.pending) {
      toast.add({ title: 'İşlem tamamlanana kadar bekleyin.', type: 'info' })
    } else if (registry.dirty) { closeOverlay(); setExit(() => action) }
    else action()
  }, [registry, closeOverlay])
  useEffect(() => {
    setNavigationGuard(registry.dirty || registry.pending ? message : null)
    return () => setNavigationGuard(null)
  }, [registry, registry.dirty, registry.pending, setNavigationGuard, message])
  useEffect(() => {
    setNavigationInterceptor?.((action) => {
      if (!registry.dirty && !registry.pending) return false
      requestExit(action)
      return true
    })
    return () => setNavigationInterceptor?.(null)
  }, [registry, requestExit, setNavigationInterceptor])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (registry.dirty || registry.pending) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [registry])
  return <Context.Provider value={{ registry, requestExit }}>
    {children}
    {exit && <UnsavedChangesDialog description={message} onKeepEditing={() => setExit(null)} onDiscard={() => {
      if (!registry.discard()) return
      setExit(null)
      exit()
    }} />}
  </Context.Provider>
}

export function useDashboardDrafts() {
  const context = useContext(Context)
  if (!context) throw new Error('DashboardDraftProvider is required')
  useSyncExternalStore(context.registry.subscribe, context.registry.snapshot, context.registry.snapshot)
  return context
}

export function useDashboardDraft(dirty: boolean, pending: boolean, discard: () => void) {
  const { registry } = useDashboardDrafts()
  const id = useId()
  const discardRef = useRef(discard)
  discardRef.current = discard
  useEffect(() => { registry.set(id, { dirty, pending, discard: () => discardRef.current() }) }, [registry, id, dirty, pending])
  useEffect(() => () => registry.remove(id), [registry, id])
}
