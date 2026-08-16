import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   The durable source of truth for "did this person pay." Runs
   server-to-server from Stripe, independent of whether the customer's
   browser ever makes it back to the success URL (closed tab, dead
   wifi, whatever) — so this, not checkout-status, is what you can
   actually rely on. Signature verification means only Stripe can flip
   `paid` to true here.
-------------------------------------------------------------------*/

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(req) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const leadId = session.client_reference_id;

    if (leadId && supabaseAdmin) {
      const { error } = await supabaseAdmin.from("leads").upsert({
        id: leadId,
        paid: true,
        email: session.customer_details?.email,
        stripe_session_id: session.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
