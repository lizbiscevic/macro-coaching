import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isCoach } from "@/lib/isCoach";
import { buildClientRow } from "@/lib/coachMetrics";
import { isConnected } from "@/lib/mymacros";
import CoachDashboard from "@/components/CoachDashboard";

export default async function CoachPage({ searchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isCoach(user.email)) redirect("/portal");

  const { data: leads } = await supabaseAdmin.from("leads").select("*").eq("paid", true).order("paid_at");
  const leadIds = (leads || []).map((l) => l.id);

  const { data: allCheckins } = leadIds.length
    ? await supabaseAdmin.from("checkins").select("*").in("lead_id", leadIds)
    : { data: [] };

  const checkinsByLead = new Map();
  for (const c of allCheckins || []) {
    if (!checkinsByLead.has(c.lead_id)) checkinsByLead.set(c.lead_id, []);
    checkinsByLead.get(c.lead_id).push(c);
  }

  const rows = (leads || [])
    .map((lead) => buildClientRow(lead, checkinsByLead.get(lead.id) || []))
    .sort((a, b) => b.flags.length - a.flags.length);

  const mymacrosConnected = await isConnected();

  return <CoachDashboard rows={rows} mymacrosConnected={mymacrosConnected} mymacrosNotice={params?.mymacros} />;
}
