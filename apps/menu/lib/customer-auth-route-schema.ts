import { z } from 'zod'

export const customerAuthContextSchema = z.object({
  returnPath: z.string().max(2_048).optional(),
  surface: z.enum(['menu', 'cart', 'order', 'bill', 'split', 'service', 'sadakat']).optional(),
  restaurantId: z.string().uuid().optional(),
  restaurantSlug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  tableId: z.string().uuid().optional(),
  qrToken: z.string().min(1).max(512).optional(),
  guestSessionId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  name: z.string().trim().max(80).optional(),
  consent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
})
