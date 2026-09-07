import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@garsonless/db/types";

export async function createDashboardAuthClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                options as Parameters<typeof cookieStore.set>[2],
              ),
            );
          } catch {
            // Called from a Server Component — cookie writes are expected to fail
          }
        },
      },
    },
  );
}
