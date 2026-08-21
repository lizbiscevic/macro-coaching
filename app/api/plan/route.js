import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";
import { pushMacroTargets } from "@/lib/mymacros";

/* ------------------------------------------------------------------
   Coach-only: sets a coached-tier client's protein/carb/fat targets.
   First save auto-messages the client and (best-effort) pushes the
   targets to My Macros+ if they've connected an account; later edits
   just update the numbers without re-notifying or re-pushing.
-------------------------------------------------------------------*/

export async function POST(req) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoach(user.email)) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { leadId, protein, carbs, fat } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const macroTargets = { protein, carbs, fat };
  const firstTime = !lead.plan_notified_at;

  const { error } = await supabaseAdmin
    .from("leads")
    .update({
      macro_targets: macroTargets,
      plan_notified_at: lead.plan_notified_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (firstTime) {
    await supabaseAdmin.from("messages").insert({
      lead_id: leadId,
      sender: "coach",
      body: "Your plan is ready — check it out in Step 3 of your portal.",
    });
  }

  const { data: latestCheckin } = await supabaseAdmin
    .from("checkins")
    .select("mymacros_email")
    .eq("lead_id", leadId)
    .not("mymacros_email", "is", null)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestCheckin?.mymacros_email) {
    // Awaited, not fire-and-forget — a serverless function can be frozen
    // right after the response is sent, which would kill an unawaited call.
    await pushMacroTargets(latestCheckin.mymacros_email, macroTargets);
  }

  return NextResponse.json({ ok: true });
}
