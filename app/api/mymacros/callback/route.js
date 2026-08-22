import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mymacros";

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("mymacros_oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(`${origin}/coach?mymacros=error`);
  }

  try {
    await exchangeCode(code, `${origin}/api/mymacros/callback`);
    const res = NextResponse.redirect(`${origin}/coach?mymacros=connected`);
    res.cookies.delete("mymacros_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${origin}/coach?mymacros=error`);
  }
}
