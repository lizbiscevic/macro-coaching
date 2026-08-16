import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLeadForUser } from "@/lib/leads";
import { isCoach } from "@/lib/isCoach";

/* ------------------------------------------------------------------
   A thread per client. The coach can read/write any thread; a client
   can only read/write their own. `sender` is always derived from the
   session server-side — a client can never post as "coach".
-------------------------------------------------------------------*/

async function authorize(leadId) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isCoach(user.email)) return { role: "coach" };

  const lead = await getLeadForUser(user);
  if (lead && lead.id === leadId) return { role: "client" };
  return null;
}

export async function GET(req) {
  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const auth = await authorize(leadId);
  if (!auth) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req) {
  const body = await req.json();
  const { leadId, body: text } = body || {};
  if (!leadId || !text?.trim()) return NextResponse.json({ error: "leadId and body required" }, { status: 400 });

  const auth = await authorize(leadId);
  if (!auth) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const { error } = await supabaseAdmin.from("messages").insert({
    lead_id: leadId,
    sender: auth.role,
    body: text.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
