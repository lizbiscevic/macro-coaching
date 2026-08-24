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

  // Read the pre-save state so the notification below only fires on the
  // incomplete -> complete transition, not on every later edit of a week
  // that was already complete.
  const { data: existingRow } = await supabaseAdmin
    .from("checkins")
    .select("weigh_in, calories")
    .eq("lead_id", lead.id)
    .eq("week_number", weekNumber)
    .maybeSingle();
  const wasComplete = isCheckinComplete(existingRow);

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

  // Every week's check-in newly going complete means the coach has
  // something to act on — week 1 to set/approve the initial plan (DIY
  // approval or a coached client's first targets), and every week after
  // that to review progress and decide on an adjustment. DIY has no
  // ongoing weeks past baseline, so this only continues for coached tiers.
  if (!wasComplete && isCheckinComplete(row)) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.yourmacrojourney.com";
    const name = lead.name || lead.email || "A client";
    const link = `${siteUrl}/coach/${lead.id}`;

    if (weekNumber === 1) {
      if (lead.tier === "diy") {
        await notifyCoach(`Review ${name}'s DIY plan`, `${name} finished their baseline week. Review and approve their plan: ${link}`);
      } else {
        await notifyCoach(`Set ${name}'s plan`, `${name} finished their baseline week. Set their macro targets: ${link}`);
      }
    } else if (lead.tier !== "diy") {
      await notifyCoach(
        `Week ${weekNumber} check-in ready — ${name}`,
        `${name} just submitted their week ${weekNumber} check-in. Review their progress and adjust if needed: ${link}`
      );
    }
  }

  return NextResponse.json({ ok: true });
}
