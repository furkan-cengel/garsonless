'use client'
import type { ComponentProps } from 'react'
import CustomersClient from './CustomersClient'
import { DashboardDraftProvider } from '../overlays/DashboardDraftProvider'
export default function CustomersClientBoundary(props: ComponentProps<typeof CustomersClient>) {
  return <DashboardDraftProvider message="Müşteriler bölümünde kaydedilmemiş değişiklikler var. Çıkarsan taslağın silinecek."><CustomersClient {...props} /></DashboardDraftProvider>
}
