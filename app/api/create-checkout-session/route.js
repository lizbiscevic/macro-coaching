import { NextResponse } from "next/server";
import Stripe from "stripe";

/* ------------------------------------------------------------------
   Creates a Stripe Checkout Session per tier instead of using a static
   Payment Link, so the success/cancel URLs and client_reference_id can
   be set dynamically. DIY, 3-month, and 6-month are one-time charges
   (the 3/6mo Price should be the full term total, not a per-month
   price). 1-month is the only real subscription — an ordinary
   recurring price, cancelable any time, no scheduled end.
-------------------------------------------------------------------*/

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PRICE_ENV = {
  diy: "STRIPE_PRICE_DIY",
  m1: "STRIPE_PRICE_1MO",
  m3: "STRIPE_PRICE_3MO",
  m6: "STRIPE_PRICE_6MO",
};

const SUBSCRIPTION_TIERS = new Set(["m1"]);

export async function POST(req) {
  if (!stripe) return NextResponse.json({ error: "checkout is not configured" }, { status: 501 });

  // Belt-and-suspenders against a live key ever running outside the
  // production deployment — VERCEL_ENV is set automatically by Vercel
  // (production/preview/development) and isn't something a request can
  // forge, unlike a header or origin check.
  const vercelEnv = process.env.VERCEL_ENV;
  const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (isLiveKey && vercelEnv && vercelEnv !== "production") {
    return NextResponse.json({ error: "live Stripe key is not allowed outside production" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { tier, email, leadId } = body || {};
  if (!tier || !PRICE_ENV[tier]) return NextResponse.json({ error: "tier is required and must be a valid plan" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  if (!leadId) return NextResponse.json({ error: "leadId is required" }, { status: 400 });

  const priceId = process.env[PRICE_ENV[tier]];
  if (!priceId) return NextResponse.json({ error: "checkout is not configured" }, { status: 501 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: SUBSCRIPTION_TIERS.has(tier) ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: email,
      client_reference_id: leadId,
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
