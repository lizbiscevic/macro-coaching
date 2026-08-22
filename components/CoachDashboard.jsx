"use client";

import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const FLAG_LABEL = {
  "missed-checkins": "Missed check-ins",
  "wrong-direction": "Wrong direction 2wk",
};

const PLAN_LABEL = {
  set: "Set",
  "not-set": "Not set",
  auto: "Auto",
};

const MYMACROS_NOTICE = {
  connected: { tone: "ok", text: "My Macros+ connected." },
  error: { tone: "err", text: "Something went wrong connecting My Macros+ — try again." },
  not_configured: { tone: "err", text: "My Macros+ isn't configured yet (missing client ID/secret)." },
};

export default function CoachDashboard({ rows, mymacrosConnected, mymacrosNotice }) {
  const signOut = async () => {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    // Hard navigation, not router.push — this clears client state and lets
    // the server see the now-signed-out cookie fresh on the next request.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  const notice = MYMACROS_NOTICE[mymacrosNotice];

  return (
    <div className="coach">
      <header className="c-head">
        <span className="mark">Coach dashboard</span>
        <button className="signout" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="c-main">
        <div className="mm-status">
          <span className={mymacrosConnected ? "mm-ok" : "mm-off"}>
            {mymacrosConnected ? "My Macros+ connected" : "My Macros+ not connected"}
          </span>
          {!mymacrosConnected && (
            <a className="mm-connect" href="/api/mymacros/connect">
              Connect My Macros+
            </a>
          )}
        </div>
        {notice && <p className={`mm-notice mm-notice-${notice.tone}`}>{notice.text}</p>}

        {rows.length === 0 && <p className="empty">No paid clients yet.</p>}

        {rows.length > 0 && (
          <table className="c-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Week</th>
                <th>Latest weigh-in</th>
                <th>Change</th>
                <th>Avg cal (wk)</th>
                <th>Checked in</th>
                <th>Plan</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lead.id} className={r.flags.length ? "flagged" : ""}>
                  <td>
                    <Link href={`/coach/${r.lead.id}`}>{r.lead.name || r.lead.email || r.lead.id}</Link>
                  </td>
                  <td className="mono">{r.currentWeek ? `${r.currentWeek}/${r.plan?.totalWeeks}` : "—"}</td>
                  <td className="mono">{r.latestWeighIn ?? "—"}</td>
                  <td className="mono">{r.changeSinceLast != null ? (r.changeSinceLast > 0 ? "+" : "") + r.changeSinceLast : "—"}</td>
                  <td className="mono">{r.avgCaloriesThisWeek ?? "—"}</td>
                  <td className="mono">{r.checkedInThisWeek ? "yes" : "no"}</td>
                  <td className="mono">{r.planStatus ? PLAN_LABEL[r.planStatus] || r.planStatus : "—"}</td>
                  <td>
                    {r.flags.map((f) => (
                      <span className="flag" key={f}>
                        {FLAG_LABEL[f] || f}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <style>{`
.coach{background:var(--ink);color:var(--chalk);font-family:var(--body);min-height:100vh}
.c-head{max-width:1100px;margin:0 auto;padding:26px 20px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--edge)}
.mark{font-family:var(--display);font-size:19px}
.signout{background:none;border:0;color:var(--mute);font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;padding:0}
.c-main{max-width:1100px;margin:0 auto;padding:30px 20px 80px;overflow-x:auto}
.empty{color:var(--mute);font-size:14px}
.mm-status{display:flex;align-items:center;gap:14px;margin-bottom:8px;font-family:var(--mono);font-size:12px}
.mm-ok{color:var(--sage)}
.mm-off{color:var(--mute)}
.mm-connect{color:var(--gold);text-decoration:underline;text-underline-offset:3px}
.mm-notice{font-family:var(--mono);font-size:12px;margin:0 0 22px}
.mm-notice-ok{color:var(--sage)}
.mm-notice-err{color:var(--rose)}
.c-table{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}
.c-table th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);padding:0 10px 10px;border-bottom:1px solid var(--edge)}
.c-table td{padding:12px 10px;border-bottom:1px solid var(--edge)}
.c-table tr.flagged{background:rgba(179,65,58,.08)}
.c-table a{color:var(--sage);text-decoration:underline;text-underline-offset:3px}
.mono{font-family:var(--mono);color:#4A4550}
.flag{display:inline-block;background:var(--rose);color:#FFFFFF;font-family:var(--mono);font-size:10px;letter-spacing:.04em;padding:2px 7px;border-radius:2px;margin-right:6px}
      `}</style>
    </div>
  );
}
