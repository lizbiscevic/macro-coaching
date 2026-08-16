"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const ERRORS = {
  missing_code: "That link looks incomplete — enter your email for a new one.",
  not_configured: "Login isn't set up yet.",
  expired: "That link already expired or was already used — enter your email for a new one.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(ERRORS[params.get("error")] || "");

  const go = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("That email doesn't look right — check it and try again.");
    if (!supabaseBrowser) return setErr("Login isn't set up yet.");
    setErr("");
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return setErr("Couldn't send that link — try again in a minute.");
    setSent(true);
  };

  return (
    <div className="login">
      <Styles />
      <div className="card">
        <span className="mark">Macro Coaching With Liz</span>
        {sent ? (
          <p className="msg">Check your email — I sent a link to {email}.</p>
        ) : (
          <>
            <p className="msg">Enter your email and I'll send you a link in.</p>
            <input
              className="txt"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              onKeyDown={(e) => e.key === "Enter" && go()}
            />
            <button className="cta" onClick={go}>
              Send my link
            </button>
            {err && <p className="err">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
.login{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--ink);color:var(--chalk);font-family:var(--body);padding:20px}
.card{max-width:380px;width:100%;background:var(--panel);border:1px solid var(--edge);border-radius:4px;padding:28px;display:flex;flex-direction:column;gap:14px}
.mark{font-family:var(--display);font-size:19px}
.msg{color:var(--mute);font-size:14.5px;line-height:1.5;margin:0}
.txt{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-size:15px;padding:12px;border-radius:3px;width:100%}
.cta{background:var(--gold);color:#FFFFFF;border:0;border-radius:3px;padding:14px;font-weight:700;font-size:15px;cursor:pointer}
.err{color:var(--rose);font-size:13.5px;margin:0}
    `}</style>
  );
}
