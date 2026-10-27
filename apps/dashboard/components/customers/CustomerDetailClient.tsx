'use client'

import type { CustomerProfileData } from '../../lib/actions/customers'
import PageTopBar from '../layout/PageTopBar'
import CustomerProfilePanel from './CustomerProfilePanel'

/** Deep-link view of one customer. It renders the same profile as the list's side panel. */
export default function CustomerDetailClient({
  restaurantId,
  restaurantName,
  profile,
  isOwner,
  viewerId,
  referenceNow,
  backHref,
}: {
  restaurantId: string
  restaurantName: string
  profile: CustomerProfileData
  isOwner: boolean
  viewerId: string
  referenceNow: string
  backHref: string
}) {
  return (
    <div className="customer-route-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageTopBar className="customer-page-topbar" restaurantName={restaurantName} title={profile.detail.name || 'Müşteri'} backHref={backHref} />
      <div className="customer-page-scroll" style={{ flex: '1 0 auto', overflow: 'visible', background: 'var(--bg)', minWidth: 0 }}>
        <div className="customer-page-content" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 32px 60px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <CustomerProfilePanel restaurantId={restaurantId} customerId={profile.detail.customerId} isOwner={isOwner} viewerId={viewerId} referenceNow={referenceNow} initial={profile} />
          </div>
        </div>
      </div>
      <style>{`
        .customer-page-topbar { position: sticky; top: 0; z-index: 30; }
        @media (max-width: 760px) { .customer-page-content { padding: 22px 20px 48px !important; } }
        @media (max-width: 460px) { .customer-page-content { padding: 20px 12px 44px !important; } }
      `}</style>
    </div>
  )
}
