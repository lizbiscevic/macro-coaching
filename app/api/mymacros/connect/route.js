import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabaseServer";
import { isCoach } from "@/lib/isCoach";
import { authorizeUrl } from "@/lib/mymacros";

/* ------------------------------------------------------------------
   Coach clicks "Connect My Macros+" -> here -> My Macros+'s own
   approval page -> app/api/mymacros/callback. state is a short-lived
   httpOnly cookie the callback checks against, standard CSRF guard
   for OAuth redirects.
-------------------------------------------------------------------*/

export async function GET(req) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/coach", req.url));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoach(user.email)) return NextResponse.redirect(new URL("/coach", req.url));

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/mymacros/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const url = authorizeUrl(redirectUri, state);
  if (!url) return NextResponse.redirect(new URL("/coach?mymacros=not_configured", req.url));

  const res = NextResponse.redirect(url);
  res.cookies.set("mymacros_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    secure: true,
    sameSite: "lax",
  });
  return res;
}
