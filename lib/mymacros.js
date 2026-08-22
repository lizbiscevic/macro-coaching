import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ------------------------------------------------------------------
   My Macros+ OAuth2 — coach-level connection (Liz authorizes once;
   from then on the app can pull data for any client who's added her
   as coach inside My Macros+'s own app). Token pair is stored as a
   single row (id=1) since there's only ever one coach. Refresh tokens
   rotate on every use — the old one is invalidated immediately, so
   the new pair always gets stored together, never just the access
   token alone.

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

async function storeTokens(data) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("mymacros_connection").upsert({
    id: 1,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    mymacros_user_id: String(data.user_id),
    updated_at: new Date().toISOString(),
  });
}

export async function exchangeCode(code, redirectUri) {
  const data = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.MYMACROS_CLIENT_ID,
    client_secret: process.env.MYMACROS_CLIENT_SECRET,
  });
  await storeTokens(data);
  return data;
}

async function refreshTokens(refreshToken) {
  const data = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.MYMACROS_CLIENT_ID,
    client_secret: process.env.MYMACROS_CLIENT_SECRET,
  });
  await storeTokens(data);
  return data;
}

// Returns a valid access token, transparently refreshing (and re-storing
// the rotated pair) if the stored one is expired or close to it. Null
// when there's no connection yet, or Supabase isn't configured.
async function getValidAccessToken() {
  if (!supabaseAdmin) return null;
  const { data: row } = await supabaseAdmin.from("mymacros_connection").select("*").eq("id", 1).maybeSingle();
  if (!row?.access_token) return null;

  const bufferMs = 60 * 1000; // refresh a minute early, not right at the edge
  if (Date.now() < new Date(row.expires_at).getTime() - bufferMs) return row.access_token;
  if (!row.refresh_token) return null;

  const refreshed = await refreshTokens(row.refresh_token);
  return refreshed.access_token;
}

export async function isConnected() {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("mymacros_connection").select("id").eq("id", 1).maybeSingle();
  return Boolean(data);
}

// NOTE: the sample only shows fetch_actions/start_date/days — nothing that
// scopes the request to one specific client. Still unconfirmed how a coach
// call is supposed to target an individual client's data (their My Circle
// member id? an additional param not shown in this sample?). Flagged to
// double check before this is actually wired into the coach UI.
export async function fetchRange({ startDate, days = 1, actions = ["goal", "workout", "meal", "macro", "weight", "water"] }) {
  const accessToken = await getValidAccessToken();
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
