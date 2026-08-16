import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { isCoach } from "@/lib/isCoach";

/* ------------------------------------------------------------------
   Where the magic-link email sends people. Exchanges the one-time
   ?code= for a session (PKCE flow — signInWithOtp's default, which is
   why this arrives as a query param and not a #fragment a route
   handler couldn't read anyway). Email link-scanners (Outlook/Gmail
   "safe links") can pre-fetch and burn the code before a real click,
   so a failed exchange sends them back for a fresh link rather than
   showing a raw error.
-------------------------------------------------------------------*/

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}/login?error=not_configured`);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=expired`);

  const email = data.session?.user?.email;
  return NextResponse.redirect(`${origin}${isCoach(email) ? "/coach" : "/portal"}`);
}
