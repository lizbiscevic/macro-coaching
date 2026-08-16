import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ------------------------------------------------------------------
   Creates a Stripe Checkout Session per tier instead of using a static
   Payment Link, because m1/m3/m6 need to auto-end after their term —
   Payment Links can't set that, but the Checkout Sessions API can via
   subscription_data.cancel_at. DIY is a plain one-time charge.
-------------------------------------------------------------------*/

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PRICE_ENV = {
  diy: "STRIPE_PRICE_DIY",
  m1: "STRIPE_PRICE_1MO",
  m3: "STRIPE_PRICE_3MO",
  m6: "STRIPE_PRICE_6MO",
};

const TERM_MONTHS = { m1: 1, m3: 3, m6: 6 };

function monthsFromNow(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return Math.floor(d.getTime() / 1000);
}

export async function POST(req) {
  if (!stripe) return NextResponse.json({ configured: false }, { status: 501 });

  const { tier, email, leadId } = await req.json();
  const priceId = tier && process.env[PRICE_ENV[tier]];
  if (!priceId) return NextResponse.json({ configured: false }, { status: 501 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin");
  const params = {
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    client_reference_id: leadId,
    success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
  };

  if (tier === "diy") {
    params.mode = "payment";
  } else {
    params.mode = "subscription";
    // Auto-ends the coaching term — no manual cancellation needed for a
    // 1/3/6-month plan to actually stop billing on schedule.
    params.subscription_data = { cancel_at: monthsFromNow(TERM_MONTHS[tier]) };
  }

  const session = await stripe.checkout.sessions.create(params);
  return NextResponse.json({ url: session.url });
}
