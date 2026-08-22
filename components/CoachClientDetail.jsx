"use client";

import { useState } from "react";
import Link from "next/link";
import { computePlan, addWeeks, fmtShort, currentWeekNumber, isCheckinComplete, avgCalories } from "@/lib/plan";
import MessageThread from "@/components/MessageThread";

export default function CoachClientDetail({ lead, checkins, initialMessages }) {
  const plan = computePlan(lead.form || {});
  const currentWeek = plan.ok ? currentWeekNumber(lead.start_date, plan.totalWeeks) : null;
  const week1 = checkins.find((c) => c.week_number === 1);

  const weighed = checkins.filter((c) => typeof c.weigh_in === "number").sort((a, b) => a.week_number - b.week_number);
  const latestWeight = weighed[weighed.length - 1]?.weigh_in ?? null;
  const startWeight = lead.form?.weight ? Number(lead.form.weight) : null;
  const goalWeight = lead.form?.goal ? Number(lead.form.goal) : null;
  const progress = latestWeight != null && startWeight != null ? +(latestWeight - startWeight).toFixed(1) : null;

  const calTrend = checkins
    .map((c) => ({ week: c.week_number, value: avgCalories(c) }))
    .filter((p) => p.value != null)
    .sort((a, b) => a.week - b.week);
  const weightTrend = weighed.map((c) => ({ week: c.week_number, value: c.weigh_in }));

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
        {(startWeight != null || goalWeight != null) && (
          <div className="stats">
            <Stat k="Starting weight" v={startWeight ?? "—"} u="lb" />
            <Stat k="Goal weight" v={goalWeight ?? "—"} u="lb" />
            <Stat k="Current weight" v={latestWeight ?? "—"} u="lb" />
            <Stat k="Progress so far" v={progress != null ? (progress > 0 ? `+${progress}` : progress) : "—"} u="lb" />
          </div>
        )}

        {(weightTrend.length >= 2 || calTrend.length >= 2) && (
          <section className="block">
            <h2>Progress</h2>
            <div className="charts">
              {weightTrend.length >= 2 && <TrendChart title="Weight" data={weightTrend} unit="lb" color="var(--sage)" />}
              {calTrend.length >= 2 && <TrendChart title="Avg calories" data={calTrend} unit="cal" color="var(--gold)" />}
            </div>
          </section>
        )}

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
                    <td className="mono">{avgCalories(c) ?? "—"}</td>
                    <td className="mono">{c.mymacros_email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <PlanBlock lead={lead} week1={week1} />

        <BookingPrompt leadId={lead.id} />

        <section className="block">
          <h2>Messages</h2>
          <MessageThread leadId={lead.id} role="coach" initialMessages={initialMessages} />
        </section>
      </main>
    </div>
  );
}

function PlanBlock({ lead, week1 }) {
  if (lead.tier === "diy") return <DiyPlanReadOnly lead={lead} week1={week1} />;
  return <SetPlanForm leadId={lead.id} macroTargets={lead.macro_targets} />;
}

function SetPlanForm({ leadId, macroTargets }) {
  const [protein, setProtein] = useState(macroTargets?.protein ?? "");
  const [carbs, setCarbs] = useState(macroTargets?.carbs ?? "");
  const [fat, setFat] = useState(macroTargets?.fat ?? "");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          protein: protein ? Number(protein) : null,
          carbs: carbs ? Number(carbs) : null,
          fat: fat ? Number(fat) : null,
        }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <section className="block">
      <h2>{macroTargets ? "Client's plan" : "Set client's plan"}</h2>
      <div className="plan-form">
        <label className="pf-field">
          <span>Protein (g)</span>
          <input
            type="number"
            value={protein}
            onChange={(e) => {
              setProtein(e.target.value);
              setStatus("idle");
            }}
          />
        </label>
        <label className="pf-field">
          <span>Carbs (g)</span>
          <input
            type="number"
            value={carbs}
            onChange={(e) => {
              setCarbs(e.target.value);
              setStatus("idle");
            }}
          />
        </label>
        <label className="pf-field">
          <span>Fat (g)</span>
          <input
            type="number"
            value={fat}
            onChange={(e) => {
              setFat(e.target.value);
              setStatus("idle");
            }}
          />
        </label>
      </div>
      <button className="cta" onClick={save} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : macroTargets ? "Update plan" : "Save plan"}
      </button>
      {status === "saved" && <p className="hint">Saved — the client's been messaged that it's ready.</p>}
      {status === "error" && <p className="problem">That didn't save — try again.</p>}
    </section>
  );
}

function DiyPlanReadOnly({ lead, week1 }) {
  const ready = isCheckinComplete(week1);
  if (!ready) {
    return (
      <section className="block">
        <h2>Client's plan</h2>
        <p className="empty">Not generated yet — unlocks once their week one is done.</p>
      </section>
    );
  }

  const realTdee = avgCalories(week1);
  const plan = computePlan(lead.form || {}, { realTdee });
  if (!plan.ok) return null;

  return (
    <section className="block">
      <h2>Client's plan (auto-generated)</h2>
      <div className="stats">
        <Stat k="Real maintenance" v={plan.tdee} u="cal" />
        <Stat k={plan.losing ? "Deficit calories" : "Surplus calories"} v={plan.cutCals} u="cal" />
        <Stat k="Rate" v={plan.weeklyLbs.toFixed(2)} u="lb / wk" />
      </div>
    </section>
  );
}

function Stat({ k, v, u }) {
  return (
    <div className="stat">
      <span className="s-k">{k}</span>
      <span className="s-v">{v}</span>
      <span className="s-u">{u}</span>
    </div>
  );
}

function TrendChart({ title, data, unit, color }) {
  const [hover, setHover] = useState(null);
  const width = 520;
  const height = 160;
  const pad = { top: 16, right: 16, bottom: 24, left: 16 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const weeks = data.map((d) => d.week);
  const values = data.map((d) => d.value);
  const minWeek = Math.min(...weeks);
  const maxWeek = Math.max(...weeks);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valPad = (maxVal - minVal) * 0.15 || Math.max(1, Math.abs(maxVal) * 0.05);
  const lo = minVal - valPad;
  const hi = maxVal + valPad;

  const x = (w) => pad.left + (maxWeek === minWeek ? innerW / 2 : ((w - minWeek) / (maxWeek - minWeek)) * innerW);
  const y = (v) => pad.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  const points = data.map((d) => ({ ...d, cx: x(d.week), cy: y(d.value) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`).join(" ");
  const gridY = [0, 0.5, 1].map((t) => pad.top + innerH * t);
  const latest = data[data.length - 1];

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="chart-title">{title}</span>
        <span className="chart-latest">
          {latest.value}
          <span className="chart-unit">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" onMouseLeave={() => setHover(null)}>
        {gridY.map((gy, i) => (
          <line key={i} x1={pad.left} x2={width - pad.right} y1={gy} y2={gy} className="chart-grid" />
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r="3.5" fill={color} />
            <circle cx={p.cx} cy={p.cy} r="10" fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }} />
          </g>
        ))}
        <text x={pad.left} y={height - 6} className="chart-axis">
          wk {minWeek}
        </text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" className="chart-axis">
          wk {maxWeek}
        </text>
      </svg>
      {hover != null && (
        <div
          className="chart-tip"
          style={{ left: `${(points[hover].cx / width) * 100}%`, top: `${(points[hover].cy / height) * 100}%` }}
        >
          Week {points[hover].week}: {points[hover].value}
          {unit}
        </div>
      )}
    </div>
  );
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
.hint{font-size:13px;color:var(--sage);margin:10px 0 0}
.problem{font-size:13px;color:var(--rose);margin:10px 0 0}

.plan-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;max-width:420px}
.pf-field{display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.pf-field input{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:15px;padding:10px;border-radius:3px;width:100%}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--edge);border:1px solid var(--edge)}
.stat{background:var(--tide);padding:16px}
.s-k{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.s-v{display:block;font-family:var(--display);font-size:26px;font-weight:600;margin-top:6px;line-height:1}
.s-u{font-family:var(--mono);font-size:11px;color:var(--mute)}

.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.chart{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:16px;position:relative}
.chart-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.chart-title{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.chart-latest{font-family:var(--display);font-size:20px;font-weight:600}
.chart-unit{font-family:var(--mono);font-size:11px;color:var(--mute);margin-left:4px;font-weight:400}
.chart-svg{width:100%;height:auto;display:block}
.chart-grid{stroke:var(--edge);stroke-width:1}
.chart-axis{font-family:var(--mono);font-size:9px;fill:var(--mute)}
.chart-tip{position:absolute;transform:translate(-50%,-130%);background:var(--chalk);color:var(--ink);font-family:var(--mono);font-size:11px;padding:4px 8px;border-radius:3px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.15)}

@media (max-width:480px){
  .plan-form{grid-template-columns:1fr}
}
    `}</style>
  );
}
