import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLeadForUser } from "@/lib/leads";
import { isCoach } from "@/lib/isCoach";

/* ------------------------------------------------------------------
   Progress photos — monthly, optional, decoupled from the weekly
   check-in. Client uploads (POST, always to their own lead, resolved
   from the session); coach reviews (GET, coach-only). The bucket is
   private, so reads always go through a short-lived signed URL rather
   than a public one.
-------------------------------------------------------------------*/

export async function POST(req) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 401 });
  const lead = await getLeadForUser(user);
  if (!lead) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "file required" }, { status: 400 });

  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${lead.id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("progress-photos")
    .upload(path, bytes, { contentType: file.type || "image/jpeg" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error } = await supabaseAdmin.from("progress_photos").insert({ lead_id: lead.id, storage_path: path });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req) {
  const supabase = await createClient();
  if (!supabase || !supabaseAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoach(user.email)) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const leadId = new URL(req.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data: rows, error } = await supabaseAdmin
    .from("progress_photos")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photos = await Promise.all(
    (rows || []).map(async (r) => {
      const { data } = await supabaseAdmin.storage.from("progress-photos").createSignedUrl(r.storage_path, 600);
      return { id: r.id, created_at: r.created_at, url: data?.signedUrl || null };
    })
  );

  return NextResponse.json({ photos });
}
