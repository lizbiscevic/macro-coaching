import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLeadForUser } from "@/lib/leads";
import ClientPortal from "@/components/ClientPortal";

export default async function PortalPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lead = await getLeadForUser(user);
  if (!lead) {
    return (
      <EmptyState email={user.email} />
    );
  }

  const [{ data: checkins }, { data: messages }] = await Promise.all([
    supabaseAdmin.from("checkins").select("*").eq("lead_id", lead.id).order("week_number"),
    supabaseAdmin.from("messages").select("*").eq("lead_id", lead.id).order("created_at"),
  ]);

  return (
    <ClientPortal
      lead={lead}
      checkins={checkins || []}
      initialMessages={messages || []}
      bookingUrl={process.env.NEXT_PUBLIC_BOOKING_URL || ""}
    />
  );
}

function EmptyState({ email }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ink)", color: "var(--chalk)", fontFamily: "var(--body)", padding: 20, textAlign: "center" }}>
      <p style={{ maxWidth: 420, color: "var(--mute)", fontSize: 15, lineHeight: 1.6 }}>
        No active plan found for {email}. If you just paid, that can take a minute to sync —
        otherwise reach out to Liz directly.
      </p>
    </div>
  );
}
