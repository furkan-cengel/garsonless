# Media rendering policy

Masabu uses three explicit image paths:

1. Authored static and LCP assets use `next/image`, with an intrinsic size and `priority` only for the single route LCP candidate.
2. Tenant-authored Supabase images render inside `@garsonless/ui` with native responsive image elements. Their host and dimensions are runtime data, so the shared renderer must provide a bounded aspect ratio, `object-fit`, meaningful or intentionally empty alternative text, and lazy/async loading outside the LCP candidate.
3. Local blob/data previews remain unoptimized, are never persisted as public URLs, and must be revoked when their preview lifecycle ends.

Arbitrary remote hosts are not added to `images.remotePatterns`. New authored marketing images must not use a raw `<img>` element. Tenant media URLs are accepted only after the server-owned upload validators have verified ownership, bytes, type, and purpose.
