// Backward-compatible endpoint for older menu clients. Keeping this as a
// direct re-export guarantees loyalty-only previews and coupon-aware checkout
// previews use the exact same server-side pricing engine.
export { POST } from '../../checkout/preview/route'
