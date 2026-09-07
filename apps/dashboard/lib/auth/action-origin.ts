/** The configured production origin is authoritative. Loopback aliases are development-only. */
export function allowedAuthOrigin(
  origin: string | null,
  configured: string | undefined,
  production: boolean,
): string | null {
  try {
    if (!origin || !configured) return null;
    const actual = new URL(origin),
      expected = new URL(configured);
    if (actual.origin === expected.origin) return actual.origin;
    const loopback = (host: string) =>
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    return !production &&
      loopback(actual.hostname) &&
      loopback(expected.hostname) &&
      actual.protocol === expected.protocol &&
      actual.port === expected.port
      ? actual.origin
      : null;
  } catch {
    return null;
  }
}
