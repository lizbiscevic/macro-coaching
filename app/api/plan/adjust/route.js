import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";
import { computePlan, computeMacros, adjustMacros, avgCalories } from "@/lib/plan";

/* ------------------------------------------------------------------
   Coach-only: applies a weekly-adjustment recommendation from
   lib/plan.js's weeklyAdjustment(). The recommendation itself is
   computed client-side (same pure functions, same data the page
   already has) — this route just re-derives the new macro targets
   server-side from the action name (never trusts numbers from the
   client) and always sends the client a message stating the reason
   and next review date, per the rulebook's language rule.
-------------------------------------------------------------------*/

const ACTIONS = new Set(["hold", "cut-100", "add-100", "diet-break"]);

export async function POST(req) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoach(user.email)) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { leadId, action, reason } = await req.json();
  if (!leadId || !ACTIONS.has(action)) return NextResponse.json({ error: "leadId and a valid action required" }, { status: 400 });

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!lead.macro_targets?.protein) return NextResponse.json({ error: "no plan set yet" }, { status: 400 });

  const update = { updated_at: new Date().toISOString() };
  let dietBreakUntil = null;

  if (action === "cut-100") {
    update.macro_targets = adjustMacros(lead.macro_targets, -100);
  } else if (action === "add-100") {
    update.macro_targets = adjustMacros(lead.macro_targets, 100);
  } else if (action === "diet-break") {
    const { data: week1 } = await supabaseAdmin
      .from("checkins")
      .select("*")
      .eq("lead_id", leadId)
      .eq("week_number", 1)
      .maybeSingle();
    const plan = computePlan(lead.form || {}, { realTdee: avgCalories(week1) });
    if (!plan.ok) return NextResponse.json({ error: "can't compute a maintenance target for this client" }, { status: 400 });
    update.macro_targets = computeMacros(lead.form || {}, plan.tdee);
    dietBreakUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    update.diet_break_until = dietBreakUntil;
  }
  // "hold" changes nothing but still sends the review message below.

  const { error } = await supabaseAdmin.from("leads").update(update).eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nextReview = new Date(Date.now() + (action === "diet-break" ? 14 : 7) * 24 * 60 * 60 * 1000);
  const reviewDate = nextReview.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const target = update.macro_targets;
  const targetLine = target ? ` New target: ${target.protein}g protein, ${target.carbs}g carbs, ${target.fat}g fat.` : "";
  const body = `${reason || "Weekly check-in reviewed."}${targetLine} Next review: ${reviewDate}.`;

  await supabaseAdmin.from("messages").insert({ lead_id: leadId, sender: "coach", body });

  return NextResponse.json({ ok: true, macroTargets: update.macro_targets || lead.macro_targets, dietBreakUntil });
}
