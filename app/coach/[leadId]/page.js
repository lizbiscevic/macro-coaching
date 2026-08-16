import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";
import CoachClientDetail from "@/components/CoachClientDetail";

export default async function CoachClientPage({ params }) {
  const { leadId } = await params;

  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isCoach(user.email)) redirect("/portal");

  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) notFound();

  const [{ data: checkins }, { data: messages }] = await Promise.all([
    supabaseAdmin.from("checkins").select("*").eq("lead_id", leadId).order("week_number"),
    supabaseAdmin.from("messages").select("*").eq("lead_id", leadId).order("created_at"),
  ]);

  return <CoachClientDetail lead={lead} checkins={checkins || []} initialMessages={messages || []} />;
}
