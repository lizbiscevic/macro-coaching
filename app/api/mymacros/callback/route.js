import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mymacros";

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  let saved;
  try {
    saved = JSON.parse(req.cookies.get("mymacros_oauth")?.value || "null");
  } catch (e) {
    saved = null;
  }

  if (!code || !state || !saved || state !== saved.csrfToken || !saved.leadId) {
    return NextResponse.redirect(`${origin}/portal?mymacros=error`);
  }

  try {
    await exchangeCode(code, `${origin}/api/mymacros/callback`, saved.leadId);
    const res = NextResponse.redirect(`${origin}/portal?mymacros=connected`);
    res.cookies.delete("mymacros_oauth");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${origin}/portal?mymacros=error`);
  }
}
