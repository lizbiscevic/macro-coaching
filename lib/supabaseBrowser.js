"use client";

import { createBrowserClient } from "@supabase/ssr";

/* ------------------------------------------------------------------
   Browser client — used ONLY for signInWithOtp / signOut from client
   components. Never for table queries; those stay server-side behind
   lib/supabaseAdmin.js. Null when Supabase isn't configured yet, so
   the paid-demo-mode path can show a "not set up yet" message instead
   of throwing.
-------------------------------------------------------------------*/

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowser = url && anonKey ? createBrowserClient(url, anonKey) : null;
