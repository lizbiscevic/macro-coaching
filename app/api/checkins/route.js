import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLeadForUser } from "@/lib/leads";
import { isCheckinComplete } from "@/lib/plan";

/* ------------------------------------------------------------------
   A client's own weekly check-ins only — the lead is resolved from
   the session, never taken from the request body, so nobody can read
   or overwrite another client's data.
-------------------------------------------------------------------*/

async function resolveLead() {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getLeadForUser(user);
}

export async function GET() {
  const lead = await resolveLead();
  if (!lead) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("checkins")
    .select("*")
    .eq("lead_id", lead.id)
    .order("week_number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checkins: data });
}

export async function POST(req) {
  const lead = await resolveLead();
  if (!lead) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const body = await req.json();
  const { weekNumber, weighIn, calories, protein, fat, carbs, mymacrosEmail } = body || {};
  if (!weekNumber) return NextResponse.json({ error: "weekNumber required" }, { status: 400 });

  const row = {
    lead_id: lead.id,
    week_number: weekNumber,
    weigh_in: weighIn ?? null,
    calories: calories ?? null,
    protein: protein ?? null,
    fat: fat ?? null,
    carbs: carbs ?? null,
    mymacros_email: mymacrosEmail ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("checkins").upsert(row, { onConflict: "lead_id,week_number" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // DIY has no coach setting a plan by hand — the moment baseline week is
  // done, generate it automatically and let them know, once.
  if (lead.tier === "diy" && weekNumber === 1 && !lead.plan_notified_at && isCheckinComplete(row)) {
    await supabaseAdmin
      .from("leads")
      .update({ plan_notified_at: new Date().toISOString() })
      .eq("id", lead.id)
      .is("plan_notified_at", null);
    await supabaseAdmin.from("messages").insert({
      lead_id: lead.id,
      sender: "coach",
      body: "Your full plan's ready — check out Step 2 in your portal.",
    });
  }

  return NextResponse.json({ ok: true });
}
