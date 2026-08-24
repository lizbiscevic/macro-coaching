import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";

/* ------------------------------------------------------------------
   Coach-only: releases a DIY client's auto-generated plan. Doesn't
   touch the numbers themselves — the plan stays purely computed from
   their form + baseline data — this just flips the gate that lets the
   client actually see it in their portal, and optionally attaches a
   note to the "your plan's ready" message that goes out alongside it.
-------------------------------------------------------------------*/

export async function POST(req) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoach(user.email)) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { leadId, note } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const firstTime = !lead.plan_notified_at;

  const { error } = await supabaseAdmin
    .from("leads")
    .update({
      diy_plan_approved_at: lead.diy_plan_approved_at || new Date().toISOString(),
      plan_notified_at: lead.plan_notified_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (firstTime) {
    const body = note?.trim()
      ? `Your full plan's ready — check out Step 2 in your portal. ${note.trim()}`
      : "Your full plan's ready — check out Step 2 in your portal.";
    await supabaseAdmin.from("messages").insert({ lead_id: leadId, sender: "coach", body });
  }

  return NextResponse.json({ ok: true });
}
