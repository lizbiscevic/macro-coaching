"use client";

import { useState } from "react";
import Link from "next/link";
import { computePlan, addWeeks, fmtShort, currentWeekNumber } from "@/lib/plan";
import MessageThread from "@/components/MessageThread";

export default function CoachClientDetail({ lead, checkins, initialMessages }) {
  const plan = computePlan(lead.form || {});
  const currentWeek = plan.ok ? currentWeekNumber(lead.start_date, plan.totalWeeks) : null;

  return (
    <div className="detail">
      <Styles />
      <header className="d-head">
        <Link className="back" href="/coach">
          ← back to dashboard
        </Link>
        <h1>{lead.name || lead.email || lead.id}</h1>
        <p className="sub">
          {lead.email} · {lead.tier || "—"} tier
          {currentWeek ? ` · week ${currentWeek} of ${plan.totalWeeks}` : ""}
        </p>
      </header>

      <main className="d-main">
        {plan.ok && <Timeline lead={lead} plan={plan} />}

        <section className="block">
          <h2>Check-in history</h2>
          {checkins.length === 0 ? (
            <p className="empty">No check-ins yet.</p>
          ) : (
            <table className="hist">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Weigh-in</th>
                  <th>Avg cal</th>
                  <th>My Macros+</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.week_number}</td>
                    <td className="mono">{c.weigh_in ?? "—"}</td>
                    <td className="mono">{avgOf(c.calories)}</td>
                    <td className="mono">{c.mymacros_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <BookingPrompt leadId={lead.id} />

        <section className="block">
          <h2>Messages</h2>
          <MessageThread leadId={lead.id} role="coach" initialMessages={initialMessages} />
        </section>
      </main>
    </div>
  );
}

function avgOf(calories) {
  if (!calories) return "—";
  const nums = calories.filter((n) => typeof n === "number" && !Number.isNaN(n));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : "—";
}

function Timeline({ lead, plan }) {
  const start = new Date(lead.start_date + "T00:00:00");
  const withDates = plan.phases.reduce((rows, p) => {
    const priorWeeks = rows.length ? rows[rows.length - 1].weeksAcc : 0;
    const weeksAcc = priorWeeks + p.weeks;
    rows.push({ ...p, start: addWeeks(start, priorWeeks), end: addWeeks(start, weeksAcc), weeksAcc });
    return rows;
  }, []);

  return (
    <section className="block">
      <h2>Timeline</h2>
      <div className="ledger">
        {withDates.map((p) => (
          <div className="led-row" key={p.key}>
            <span className="led-label">{p.label}</span>
            <span className="led-dates">
              {fmtShort(p.start)} → {fmtShort(p.end)}
            </span>
            <span className="led-weeks">{p.weeks}w</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingPrompt({ leadId }) {
  const [sent, setSent] = useState(false);
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;

  const send = async () => {
    const body = bookingUrl
      ? `Time to schedule your call — book a time here: ${bookingUrl}`
      : "Time to schedule your call — reply here and I'll get you a time.";
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, body }),
    });
    setSent(true);
  };

  return (
    <section className="block">
      <button className="cta" onClick={send} disabled={sent}>
        {sent ? "Sent" : "Message: time to schedule your call"}
      </button>
    </section>
  );
}

function Styles() {
  return (
    <style>{`
.detail{background:var(--ink);color:var(--chalk);font-family:var(--body);min-height:100vh}
.d-head{max-width:800px;margin:0 auto;padding:26px 20px 20px;border-bottom:1px solid var(--edge)}
.back{color:var(--mute);font-family:var(--mono);font-size:12px}
.d-head h1{font-family:var(--display);font-size:28px;font-weight:600;margin:14px 0 4px}
.sub{color:var(--mute);font-size:13.5px;font-family:var(--mono)}
.d-main{max-width:800px;margin:0 auto;padding:30px 20px 80px;display:flex;flex-direction:column;gap:40px}
.block h2{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 14px}
.empty{color:var(--mute);font-size:14px}
.ledger{border-top:1px solid var(--edge)}
.led-row{display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--edge);font-size:14px}
.led-label{flex:1}
.led-dates,.led-weeks{font-family:var(--mono);font-size:12px;color:var(--mute)}
.hist{width:100%;border-collapse:collapse;font-size:14px}
.hist th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);padding:0 10px 10px;border-bottom:1px solid var(--edge)}
.hist td{padding:10px;border-bottom:1px solid var(--edge)}
.mono{font-family:var(--mono);color:#4A4550}
.cta{background:var(--gold);color:#FFFFFF;border:0;border-radius:3px;padding:14px 20px;font-weight:700;font-size:14px;cursor:pointer}
.cta:disabled{opacity:.6;cursor:default}
    `}</style>
  );
}
