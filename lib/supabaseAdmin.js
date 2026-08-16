import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------
   Server-only Supabase client — service role key, never imported from
   a "use client" component. Degrades to null when the project isn't
   configured yet so the app still runs before Supabase is set up; API
   routes check for that and respond accordingly.
-------------------------------------------------------------------*/

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
