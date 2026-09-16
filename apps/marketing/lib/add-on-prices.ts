import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAddOnPurchasePort } from '@garsonless/db/server'
export const readMarketingAddOnPrice = unstable_cache(
  async () => {
    try {
      const history = await createAddOnPurchasePort().history()
      return (
        history
          .filter((p) => p.addOn === 'iyzico_online_payments')
          .sort((a, b) => b.version - a.version)[0] ?? null
      )
    } catch {
      return null
    }
  },
  ['marketing-one-time-add-on-prices'],
  { revalidate: 60 },
)
