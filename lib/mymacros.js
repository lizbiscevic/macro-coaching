import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   My Macros+ OAuth2 — per-client, not coach-level. Confirmed directly
   with their team (Aug 2026): each client runs their own OAuth
   connection from their portal, and the token that comes back is
   already scoped to just their own account — there's no "coach
   connects once, then looks up any client" mode, and no need to
   resolve a My Circle relationship at all. So every function here
   takes a leadId and reads/writes that lead's own token columns on
   `leads`, never a shared singleton.

   Spec source: https://my-macros-api.readme.io/reference/account-authorization
-------------------------------------------------------------------*/

const AUTH_URL = "https://getmymacros.com/oauth/authorize";
const TOKEN_URL = "https://getmymacros.com/oauth/token";
const FETCH_RANGE_URL = "https://getmymacros.com/api/fetchRange";

export function authorizeUrl(redirectUri, state) {
  const clientId = process.env.MYMACROS_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:nutrition",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`My Macros+ token request failed: ${res.status}`);
  return res.json();
}

async function storeTokens(leadId, data) {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("leads")
    .update({
      mymacros_access_token: data.access_token,
      mymacros_refresh_token: data.refresh_token,
      mymacros_token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      mymacros_user_id: String(data.user_id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
}

export async function exchangeCode(code, redirectUri, leadId) {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.MYMACROS_CLIENT_ID,
    client_secret: process.env.MYMACROS_CLIENT_SECRET,
  });
  await storeTokens(leadId, data);
  return data;
}

async function refreshTokens(leadId, refreshToken) {
  const data = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.MYMACROS_CLIENT_ID,
    client_secret: process.env.MYMACROS_CLIENT_SECRET,
  });
  await storeTokens(leadId, data);
  return data;
}

// Returns a valid access token for this specific lead, transparently
// refreshing (and re-storing the rotated pair) if the stored one is
// expired or close to it. Null when this lead hasn't connected, or
// Supabase isn't configured.
async function getValidAccessToken(leadId) {
  if (!supabaseAdmin) return null;
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("mymacros_access_token, mymacros_refresh_token, mymacros_token_expires_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.mymacros_access_token) return null;

  const bufferMs = 60 * 1000; // refresh a minute early, not right at the edge
  if (Date.now() < new Date(lead.mymacros_token_expires_at).getTime() - bufferMs) {
    return lead.mymacros_access_token;
  }
  if (!lead.mymacros_refresh_token) return null;

  const refreshed = await refreshTokens(leadId, lead.mymacros_refresh_token);
  return refreshed.access_token;
}

export async function isConnected(leadId) {
  if (!supabaseAdmin || !leadId) return false;
  const { data } = await supabaseAdmin.from("leads").select("mymacros_user_id").eq("id", leadId).maybeSingle();
  return Boolean(data?.mymacros_user_id);
}

// Pulls one client's own nutrition data — always scoped to whoever this
// leadId belongs to, since that's whose token this is.
export async function fetchRange(leadId, { startDate, days = 1, actions = ["goal", "workout", "meal", "macro", "weight", "water"] }) {
  const accessToken = await getValidAccessToken(leadId);
  if (!accessToken) return null;

  const params = new URLSearchParams({
    fetch_actions: JSON.stringify(actions),
    start_date: startDate,
    days: String(days),
  });

  const res = await fetch(`${FETCH_RANGE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// update.php / push-goal isn't built yet — My Macros+'s OAuth support for
// that endpoint isn't finished on their end (per their team, Aug 2026).
// Nothing to wire up until they confirm the real shape.
