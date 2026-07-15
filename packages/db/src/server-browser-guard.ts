/**
 * Conditional browser export. A client component that accidentally reaches for
 * the service-role boundary fails loudly instead of bundling credentials.
 */
throw new Error('@garsonless/db/server is server-only; import @garsonless/db/browser from client code')
