import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLeadForUser } from "@/lib/leads";
import { isCheckinComplete } from "@/lib/plan";
import { notifyCoach } from "@/lib/notify";

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

  // Baseline week done -> the coach needs to act: approve a DIY client's
  // auto-generated plan before it goes out (see /api/plan/approve), or set
  // a coached client's targets by hand (see /api/plan). Ping her once,
  // never on a later re-save of week 1.
  if (weekNumber === 1 && !lead.baseline_ready_notified_at && isCheckinComplete(row)) {
    await supabaseAdmin
      .from("leads")
      .update({ baseline_ready_notified_at: new Date().toISOString() })
      .eq("id", lead.id)
      .is("baseline_ready_notified_at", null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yourmacrojourney.com";
    const name = lead.name || lead.email || "A client";
    const link = `${siteUrl}/coach/${lead.id}`;
    if (lead.tier === "diy") {
      await notifyCoach(`Review ${name}'s DIY plan`, `${name} finished their baseline week. Review and approve their plan: ${link}`);
    } else {
      await notifyCoach(`Set ${name}'s plan`, `${name} finished their baseline week. Set their macro targets: ${link}`);
    }
  }

  return NextResponse.json({ ok: true });
}
