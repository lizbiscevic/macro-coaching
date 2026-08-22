import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";

/* ------------------------------------------------------------------
   Coach-only: sets a coached-tier client's protein/carb/fat targets.
   First save auto-messages the client; later edits just update the
   numbers without re-notifying. Pushing targets to My Macros+ isn't
   wired up yet — their update endpoint's OAuth support isn't finished
   on their end (per their team, Aug 2026).
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

  return NextResponse.json({ ok: true });
}
