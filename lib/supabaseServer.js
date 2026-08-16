import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ------------------------------------------------------------------
   Server Component / Route Handler client — resolves the signed-in
   user from cookies. Used only for auth.getUser(); table access stays
   behind lib/supabaseAdmin.js, same trust boundary as everywhere else
   in this app. Null-safe like supabaseAdmin so an unconfigured clone
   doesn't crash before Supabase env vars are set.
-------------------------------------------------------------------*/

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createClient() {
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (e) {
          // Called from a Server Component render, where cookies can't be
          // written — middleware.js is what actually refreshes the session.
        }
      },
    },
  });
}
