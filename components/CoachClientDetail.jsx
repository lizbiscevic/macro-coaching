"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  computePlan,
  computeMacros,
  addWeeks,
  fmtShort,
  currentWeekNumber,
  isCheckinComplete,
  avgCalories,
  weeklyAdjustment,
  reverseChainLabel,
  expectedRateRange,
  planRules,
} from "@/lib/plan";
import MessageThread from "@/components/MessageThread";

export default function CoachClientDetail({ lead, checkins, initialMessages }) {
  const week1 = checkins.find((c) => c.week_number === 1);
  const plan = computePlan(lead.form || {}, {
    realTdee: lead.tier !== "diy" ? avgCalories(week1) : undefined,
    ageAdjustedTdee: true,
  });
  // DIY is a one-time thing, not an ongoing weekly cadence — "week X of Y"
  // only makes sense for the coached tiers' recurring check-in loop.
  const currentWeek = lead.tier !== "diy" && plan.ok ? currentWeekNumber(lead.start_date, plan.totalWeeks) : null;

  const weighed = checkins.filter((c) => typeof c.weigh_in === "number").sort((a, b) => a.week_number - b.week_number);
  const latestWeight = weighed[weighed.length - 1]?.weigh_in ?? null;
  const startWeight = lead.form?.weight ? Number(lead.form.weight) : null;
  const goalWeight = lead.form?.goal ? Number(lead.form.goal) : null;
  const progress = latestWeight != null && startWeight != null ? +(latestWeight - startWeight).toFixed(1) : null;

  const calTrend = checkins
    .map((c) => ({ week: c.week_number, value: avgCalories(c) }))
    .filter((p) => p.value != null)
    .sort((a, b) => a.week - b.week);
  const weightSeries = weighed.map((c) => ({ week: c.week_number, value: c.weigh_in }));

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

        {(weightSeries.length >= 2 || calTrend.length >= 2) && (
          <section className="block">
            <h2>Progress</h2>
            <div className="charts">
              {weightSeries.length >= 2 && <TrendChart title="Weight" data={weightSeries} unit="lb" color="var(--sage)" />}
              {calTrend.length >= 2 && <TrendChart title="Avg calories" data={calTrend} unit="cal" color="var(--gold)" />}
            </div>
          </section>
        )}

        {lead.tier !== "diy" && plan.ok && <Timeline lead={lead} plan={plan} />}

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

        {lead.tier !== "diy" && <WeeklyReview lead={lead} checkins={checkins} plan={plan} />}

        <PlanBlock lead={lead} week1={week1} />

        {lead.tier !== "diy" && <BookingPrompt leadId={lead.id} />}

        <ProgressPhotos leadId={lead.id} />

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

function diyWhatHappens(p, plan) {
  if (p.kind === "cut" || p.kind === "gain") {
    const rate = expectedRateRange(plan.weeklyLbs);
    return `${plan.cutCals.toLocaleString()} cal. Expect ${rate.low}–${rate.high} lb/week; ~${plan.weeklyLbs.toFixed(1)} lb/week average`;
  }
  if (p.kind === "break") {
    return `${p.weeks} week${p.weeks > 1 ? "s" : ""} at ~${plan.tdee.toLocaleString()} cal (real maintenance) — built in since this deficit runs past ~3 months`;
  }
  if (p.kind === "reverse") return reverseChainLabel(plan);
  if (p.kind === "hold") return `Hold at ~${plan.goalTdee.toLocaleString()} cal for at least 8 weeks before any new deficit`;
  return "";
}

// Mirrors the plan document the client sees (ClientPortal.jsx's DiyPlan)
// so this is what's actually being reviewed here, not an approximation
// of it — same math, same content, just without the email/print actions
// that only make sense on the client's own side.
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
  const plan = computePlan(lead.form || {}, { realTdee, simpleDietBreaks: true, ageAdjustedTdee: true });
  if (!plan.ok) return null;

  const f = lead.form || {};
  const female = f.sex !== "male";
  const macros = computeMacros(f, plan.cutCals);
  const rules = planRules(lead, plan);
  const fatPct = Math.round(((macros.fatG * 9) / plan.cutCals) * 100);
  const proteinPerLb = (macros.proteinG / (+f.goal || 1)).toFixed(2);

  const start = new Date(lead.start_date + "T00:00:00");
  const rows = plan.phases
    .reduce((acc, p) => {
      const priorWeeks = acc.length ? acc[acc.length - 1].weeksAcc : 0;
      const weeksAcc = priorWeeks + p.weeks;
      acc.push({ ...p, weeksAcc, weekStart: priorWeeks, weekEnd: weeksAcc - 1 });
      return acc;
    }, [])
    .filter((p) => p.kind !== "baseline");

  const approved = Boolean(lead.diy_plan_approved_at);

  return (
    <section className="block">
      <h2>Client's plan (auto-generated{approved ? " — sent" : " — awaiting your review"})</h2>

      <div className="stats">
        <NumberStat k="Calories" v={plan.cutCals} range={`${plan.cutCals - 25}–${plan.cutCals + 25}`} />
        <NumberStat k="Protein" v={macros.proteinG} u="g" range={`${macros.proteinG - 5}–${macros.proteinG + 5}g`} note="hit this" />
        <NumberStat k="Fat" v={macros.fatG} u="g" range={`${macros.fatG - 5}–${macros.fatG + 5}g`} note="stay near this" />
        <NumberStat k="Carbs" v={macros.carbsG} u="g" range={`${macros.carbsG - 5}–${macros.carbsG + 5}g`} note="fill the rest" />
        <NumberStat k="Fiber" v={macros.fiberG} u="g" note="minimum" />
      </div>

      <ul className="doc-list">
        <li>
          {realTdee ? "Real" : "Estimated"} maintenance: ~{plan.tdee.toLocaleString()} cal
          {realTdee ? " (from tracked week)" : " (formula)"}
        </li>
        <li>Deficit: {Math.round(((plan.tdee - plan.cutCals) / plan.tdee) * 100)}% below maintenance</li>
        <li>
          Protein: {proteinPerLb} g/lb of goal weight{(+f.age || 0) >= 30 ? " (upper end)" : ""} · Fat: {fatPct}% of calories, floor{" "}
          {female ? 45 : 50}g
        </li>
      </ul>

      <div className="timeline-table">
        {rows.map((r) => (
          <div className="tt-row" key={r.key}>
            <span className="tt-phase">{r.label}</span>
            <span className="tt-weeks">{r.weekStart === r.weekEnd ? r.weekStart : `${r.weekStart}–${r.weekEnd}`}</span>
            <span className="tt-desc">{diyWhatHappens(r, plan)}</span>
          </div>
        ))}
      </div>
      <p className="empty" style={{ marginTop: 10 }}>
        Finish: ~{plan.dietingWeeks + plan.reverseWeeks} weeks to {f.goal} lb and holding it.
      </p>

      <details className="doc-details">
        <summary>Rules &amp; when-to-change text (as shown to client)</summary>
        <ul className="doc-list">
          {rules.weeklyRules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <ul className="doc-list">
          {rules.changeRules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <p className="empty">{rules.doneText}</p>
      </details>

      <ApproveDiyPlan leadId={lead.id} approved={approved} />
    </section>
  );
}

// The client doesn't see this plan until she's looked at it — this is
// where that gate actually opens. Doesn't let her edit the computed
// numbers (that's a bigger feature for later if she wants it), just
// review-and-release, with an optional note that rides along with the
// "your plan's ready" message.
function ApproveDiyPlan({ leadId, approved }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(approved ? "approved" : "idle"); // idle | saving | approved | error

  if (status === "approved") {
    return <p className="hint">✓ Approved — client's been notified.</p>;
  }

  const approve = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, note: note || null }),
      });
      setStatus(res.ok ? "approved" : "error");
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <div className="approve-block">
      <label className="flabel">Note to include (optional)</label>
      <textarea
        className="approve-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you want to add when this goes out..."
      />
      <button className="cta" onClick={approve} disabled={status === "saving"}>
        {status === "saving" ? "Sending…" : "Approve & send to client"}
      </button>
      {status === "error" && <p className="problem">That didn't go through — try again.</p>}
    </div>
  );
}

function NumberStat({ k, v, u, range, note }) {
  return (
    <div className="stat">
      <span className="s-k">{k}</span>
      <span className="s-v">
        {v}
        {u && <span className="s-u"> {u}</span>}
      </span>
      {range && <span className="s-range">{range}</span>}
      {note && <span className="s-note">{note}</span>}
    </div>
  );
}

const ACTION_LABEL = {
  hold: "Send hold message",
  "cut-100": "Apply: cut 100 cal",
  "add-100": "Apply: add 100 cal",
  "diet-break": "Start diet break",
};

function trendLine(trend) {
  if (!trend) return "—";
  if (trend.deltaLb === 0) return "Flat this week";
  return `${trend.deltaLb < 0 ? "Down" : "Up"} ${Math.abs(trend.deltaLb)} lb this week`;
}

function WeeklyReview({ lead, checkins, plan }) {
  const rec = weeklyAdjustment(lead, checkins, plan);
  const [applying, setApplying] = useState(null);
  const [done, setDone] = useState(null);

  const apply = async (action) => {
    setApplying(action);
    try {
      const res = await fetch("/api/plan/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, action, reason: rec.reason }),
      });
      setDone(res.ok ? "ok" : "error");
    } catch (e) {
      setDone("error");
    } finally {
      setApplying(null);
    }
  };

  const sendStepsMessage = async () => {
    setApplying("steps");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          body: "Two slower weeks in a row — let's try adding 2,000 steps before touching food. Same targets, more movement. Next review in a week.",
        }),
      });
      setDone(res.ok ? "ok" : "error");
    } catch (e) {
      setDone("error");
    } finally {
      setApplying(null);
    }
  };

  return (
    <section className="block">
      <h2>Weekly review</h2>
      {rec.status === "no-target" && <p className="empty">Set a plan below before weekly reviews start.</p>}
      {rec.status === "not-enough-data" && (
        <p className="empty">Not enough weigh-ins yet — needs at least two check-ins after baseline.</p>
      )}
      {rec.status === "on-break" && (
        <p className="empty">
          On a diet break until {new Date(rec.until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
        </p>
      )}
      {rec.status === "ready" && (
        <>
          <div className="stats">
            <Stat k="Trend" v={trendLine(rec.trend)} u="" />
            <Stat k="Adherence" v={rec.adherence ? `${rec.adherence.pct}%` : "—"} u="" />
            <Stat k="Target rate" v={rec.targetRate.toFixed(2)} u="lb / wk" />
          </div>
          <p className="review-reason">{rec.reason}</p>
          {done === "ok" ? (
            <p className="hint">Applied — client's been messaged.</p>
          ) : (
            <div className="review-actions">
              <button className="cta" onClick={() => apply(rec.action)} disabled={!!applying}>
                {applying === rec.action ? "Applying…" : ACTION_LABEL[rec.action]}
              </button>
              {rec.action === "cut-100" && (
                <button className="cta ghost" onClick={sendStepsMessage} disabled={!!applying}>
                  {applying === "steps" ? "Sending…" : "Message: try steps instead"}
                </button>
              )}
            </div>
          )}
          {done === "error" && <p className="problem">That didn't go through — try again.</p>}
        </>
      )}
    </section>
  );
}

function ProgressPhotos({ leadId }) {
  const [photos, setPhotos] = useState(null); // null = loading
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/photos?leadId=${leadId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setPhotos(data.photos || []))
      .catch(() => {
        setError(true);
        setPhotos([]);
      });
  }, [leadId]);

  return (
    <section className="block">
      <h2>Progress photos</h2>
      {error && <p className="empty">Couldn't load photos.</p>}
      {photos == null && !error && <p className="empty">Loading…</p>}
      {photos != null && photos.length === 0 && !error && <p className="empty">No photos uploaded yet.</p>}
      {photos != null && photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <a key={p.id} href={p.url || "#"} target="_blank" rel="noreferrer" className="photo-cell">
              {p.url && <img src={p.url} alt="Progress" />}
              <span>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </a>
          ))}
        </div>
      )}
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
            <div className="led-top">
              <span className="led-label">{p.label}</span>
              <span className="led-dates">
                {fmtShort(p.start)} → {fmtShort(p.end)}
              </span>
              <span className="led-weeks">{p.weeks}w</span>
            </div>
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
.led-row{padding:11px 2px;border-bottom:1px solid var(--edge);font-size:14px}
.led-row.led-sub{padding:8px 2px 8px 18px;border-bottom:1px dashed var(--edge)}
.led-row.led-sub .led-label{color:var(--mute);font-size:13px}
.led-top{display:flex;align-items:center;gap:12px}
.led-label{flex:1}
.led-dates,.led-cal,.led-weeks{font-family:var(--mono);font-size:12px;color:var(--mute)}
.led-macros{display:flex;gap:16px;margin-top:6px;font-family:var(--mono);font-size:11.5px;color:var(--sage)}
.hist{width:100%;border-collapse:collapse;font-size:14px}
.hist th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);padding:0 10px 10px;border-bottom:1px solid var(--edge)}
.hist td{padding:10px;border-bottom:1px solid var(--edge)}
.mono{font-family:var(--mono);color:#4A4550}
.cta{background:var(--gold);color:#FFFFFF;border:0;border-radius:3px;padding:14px 20px;font-weight:700;font-size:14px;cursor:pointer}
.cta:disabled{opacity:.6;cursor:default}
.cta.ghost{background:transparent;border:1px solid var(--gold);color:var(--gold)}
.hint{font-size:13px;color:var(--sage);margin:10px 0 0}
.problem{font-size:13px;color:var(--rose);margin:10px 0 0}
.review-reason{font-size:14px;color:#4A4550;margin:0 0 16px;max-width:60ch}
.review-actions{display:flex;gap:10px;flex-wrap:wrap}
.flabel{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-bottom:8px}
.approve-block{margin-top:20px;padding-top:20px;border-top:1px solid var(--edge)}
.approve-note{width:100%;min-height:70px;background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:14px;padding:10px;border-radius:3px;resize:vertical;margin-bottom:12px}

.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.photo-cell{display:block;border:1px solid var(--edge);border-radius:4px;overflow:hidden;text-decoration:none;color:var(--mute);font-family:var(--mono);font-size:10px}
.photo-cell img{width:100%;height:120px;object-fit:cover;display:block;background:var(--tide)}
.photo-cell span{display:block;padding:6px 8px}

.plan-form{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;max-width:420px}
.pf-field{display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.pf-field input{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:15px;padding:10px;border-radius:3px;width:100%}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--edge);border:1px solid var(--edge)}
.stat{background:var(--tide);padding:16px}
.s-k{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.s-v{display:block;font-family:var(--display);font-size:26px;font-weight:600;margin-top:6px;line-height:1}
.s-u{font-family:var(--mono);font-size:11px;color:var(--mute)}
.s-range{display:block;font-family:var(--mono);font-size:11px;color:var(--mute);margin-top:6px}
.s-note{display:block;font-family:var(--mono);font-size:10.5px;color:var(--sage);margin-top:2px}

.doc-list{margin:16px 0;padding-left:0;list-style:none}
.doc-list li{position:relative;padding-left:16px;margin-bottom:8px;font-size:13.5px;color:#4A4550;line-height:1.5}
.doc-list li:before{content:"";position:absolute;left:0;top:8px;width:7px;height:1px;background:var(--sage)}

.timeline-table{border-top:1px solid var(--edge);margin-top:14px}
.tt-row{display:grid;grid-template-columns:140px 60px 1fr;gap:12px;padding:10px 2px;border-bottom:1px solid var(--edge);font-size:13.5px;align-items:baseline}
.tt-phase{font-weight:600}
.tt-weeks{font-family:var(--mono);font-size:11.5px;color:var(--mute)}
.tt-desc{font-size:13px;color:#4A4550;line-height:1.5}

.doc-details{margin-top:16px;border:1px solid var(--edge);border-radius:4px;padding:12px 16px}
.doc-details summary{cursor:pointer;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.doc-details .doc-list{margin-top:12px}

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
