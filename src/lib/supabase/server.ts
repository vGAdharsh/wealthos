import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Server-side Supabase client bound to the request's cookies.
 * Never receives the service-role key — Row Level Security (spec Part 8)
 * is the authorisation boundary, and the anon key + authenticated user
 * is the strongest credential allowed on the client side of the app.
 */
export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured())
    throw new Error("Supabase is not configured on the server");
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when
          // middleware is refreshing sessions.
        }
      },
    },
  });
}
