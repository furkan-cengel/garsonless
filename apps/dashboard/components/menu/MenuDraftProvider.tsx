'use client'
import type { ReactNode } from 'react'
import { DashboardDraftProvider } from '../overlays/DashboardDraftProvider'
export { useDashboardDraft as useMenuDraft, useDashboardDrafts as useMenuDrafts } from '../overlays/DashboardDraftProvider'
export function MenuDraftProvider({ children }: { children: ReactNode }) {
  return <DashboardDraftProvider message="Menüde kaydedilmemiş değişiklikler var. Çıkarsan bu değişiklikler silinecek.">{children}</DashboardDraftProvider>
}
