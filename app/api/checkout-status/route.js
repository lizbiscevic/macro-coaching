import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   Hit when the browser lands back on the success URL Stripe redirects
   to after a Payment Link checkout (?session_id={CHECKOUT_SESSION_ID}).
   Never trust that redirect by itself — a browser can hit this URL
   without having paid. Ask Stripe directly whether the session actually
   paid, and only then mark the lead paid in Supabase. The webhook does
   the same upsert independently and is the durable source of truth;
   this route just gives the browser an immediate, verified answer
   instead of waiting on the webhook to land.
-------------------------------------------------------------------*/

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function GET(req) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !stripe) return NextResponse.json({ paid: false }, { status: 400 });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    // Not our error to surface — a fake, expired, or wrong-mode session id
    // just means "not paid" as far as the browser needs to know.
    return NextResponse.json({ paid: false }, { status: 200 });
  }

  const paid = session.payment_status === "paid";
  const leadId = session.client_reference_id || null;

  if (paid && leadId && supabaseAdmin) {
    await supabaseAdmin.from("leads").upsert({
      id: leadId,
      paid: true,
      email: session.customer_details?.email,
      stripe_session_id: session.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ paid, leadId });
}
