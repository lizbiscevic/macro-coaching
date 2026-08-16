import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   Resolves the `leads` row for a signed-in Supabase Auth user. Auth
   happens after payment, on a schedule the user doesn't control (they
   click the magic link whenever), so a lead can be paid long before
   it has a user_id — this looks up by user_id first, then falls back
   to matching by email and backfilling the link.
-------------------------------------------------------------------*/

export async function getLeadForUser(user) {
  if (!supabaseAdmin || !user) return null;

  const byUserId = await supabaseAdmin.from("leads").select("*").eq("user_id", user.id).maybeSingle();
  if (byUserId.data) return byUserId.data;

  if (!user.email) return null;

  const byEmail = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("email", user.email)
    .is("user_id", null)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byEmail.data) return null;

  // Race-safe: only claims the row if it's still unlinked.
  const { data: claimed } = await supabaseAdmin
    .from("leads")
    .update({ user_id: user.id })
    .eq("id", byEmail.data.id)
    .is("user_id", null)
    .select()
    .maybeSingle();

  return claimed || byEmail.data;
}
