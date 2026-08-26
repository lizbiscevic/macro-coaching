import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   Persist-before-payment, server-side. The client calls POST every
   time it would otherwise only write to localStorage (new timeline,
   tier picked, checkout submitted) so a lost tab/device doesn't lose
   the lead. GET lets the client reconcile against the real record
   instead of trusting whatever's in localStorage.
-------------------------------------------------------------------*/

export async function POST(req) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 501 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { leadId, form, startDate, tier, name, email } = body || {};
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const row = { id: leadId, updated_at: new Date().toISOString() };
  if (form !== undefined) row.form = form;
  if (startDate !== undefined) row.start_date = startDate || null;
  if (tier !== undefined) row.tier = tier;
  if (name !== undefined) row.name = name;
  if (email !== undefined) row.email = email;

  const { error } = await supabaseAdmin.from("leads").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req) {
  if (!supabaseAdmin) return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 501 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Only what the client actually needs to resume state on another device —
  // never the internal fields (stripe_session_id, macro_targets, user_id,
  // etc.), even though the id itself isn't guessable (a v4 UUID).
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, form, tier, start_date")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}
