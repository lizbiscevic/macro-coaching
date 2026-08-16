import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/* ------------------------------------------------------------------
   Refreshes the Supabase session cookie on every matched request and
   gates /portal and /coach behind being signed in. Scoped narrowly —
   must never touch /api/lead, /api/checkout-status, or
   /api/stripe/webhook, which stay pre-auth for the anonymous funnel
   and the Stripe webhook.

   Named/filed as "proxy" — Next.js 16 renamed the "middleware" file
   convention (this version's docs flag it deprecated, see AGENTS.md).
-------------------------------------------------------------------*/

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request) {
  const isGuarded = request.nextUrl.pathname.startsWith("/portal") || request.nextUrl.pathname.startsWith("/coach");

  if (!url || !anonKey) {
    // Supabase not configured yet — nothing to refresh, but the guarded
    // routes still need to bounce somewhere sane instead of crashing.
    return isGuarded ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isGuarded) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/coach/:path*", "/auth/:path*", "/login"],
};
