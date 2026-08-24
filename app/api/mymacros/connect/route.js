import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabaseServer";
import { getLeadForUser } from "@/lib/leads";
import { authorizeUrl } from "@/lib/mymacros";

/* ------------------------------------------------------------------
   A client clicks "Connect My Macros+" in their portal -> here -> My
   Macros+'s own approval page -> app/api/mymacros/callback. Each
   client runs this themselves (there's no coach-level connection —
   see lib/mymacros.js), so the lead has to be resolved from their own
   session and carried through the redirect round-trip. state carries
   both the CSRF token and which lead initiated this, packed into one
   httpOnly cookie the callback reads back.
-------------------------------------------------------------------*/

export async function GET(req) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL("/portal", req.url));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const lead = await getLeadForUser(user);
  if (!lead) return NextResponse.redirect(new URL("/portal", req.url));

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/mymacros/callback`;
  const csrfToken = crypto.randomBytes(16).toString("hex");
  const url = authorizeUrl(redirectUri, csrfToken);
  if (!url) return NextResponse.redirect(new URL("/portal?mymacros=not_configured", req.url));

  const res = NextResponse.redirect(url);
  res.cookies.set("mymacros_oauth", JSON.stringify({ csrfToken, leadId: lead.id }), {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    secure: true,
    sameSite: "lax",
  });
  return res;
}
