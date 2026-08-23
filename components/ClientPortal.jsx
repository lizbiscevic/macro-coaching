"use client";

import { useState } from "react";
import {
  computePlan,
  computeMacros,
  currentWeekNumber,
  isCheckinComplete,
  avgCalories,
  addWeeks,
  fmtShort,
  reverseChainLabel,
  expectedRateRange,
  planRules,
} from "@/lib/plan";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import MessageThread from "@/components/MessageThread";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUPPORT_EMAIL = "hello@yourmacrojourney.com";

// A ready-to-send fallback for "this broke" moments — clients won't have
// Liz's phone number, so the recovery path is always email, pre-filled so
// there's nothing to type beyond attaching whatever the instruction asks for.
function supportMailto(subject, instruction = "Screenshot attached.") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    `Hey Liz — this didn't work for me. ${instruction}\n\n`
  )}`;
}

/* ------------------------------------------------------------------
   Two entirely separate flows: coached tiers (m1/m3/m6) get an
   ongoing weekly check-in loop, a call-booking step, and a plan the
   coach sets by hand. DIY is a one-time thing — a single baseline
   week, then an auto-generated plan, no ongoing check-ins and no
   booking step at all.
-------------------------------------------------------------------*/

export default function ClientPortal({ lead, checkins, initialMessages, bookingUrl }) {
  if (lead.tier === "diy") {
    return <DiyPortal lead={lead} checkins={checkins} initialMessages={initialMessages} />;
  }
  return <CoachedPortal lead={lead} checkins={checkins} initialMessages={initialMessages} bookingUrl={bookingUrl} />;
}

function signOutAndGoHome() {
  return async () => {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    // Hard navigation, not router.push — this clears client state and lets
    // the server see the now-signed-out cookie fresh on the next request.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };
}

function Header() {
  const signOut = signOutAndGoHome();
  return (
    <header className="p-head">
      <span className="mark">Macro Coaching With Liz</span>
      <button className="signout" onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}

function StepHeader({ n, title, locked }) {
  return (
    <div className="step-head">
      <p className="eyebrow center">
        Step {n}
        {locked ? " · locked" : ""}
      </p>
      <h2 className="ph2">{title}</h2>
    </div>
  );
}

function LockedCard({ note }) {
  return (
    <section className="locked-card">
      <p>🔒 {note}</p>
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

/* ============================== DIY ============================== */

function DiyPortal({ lead, checkins, initialMessages }) {
  const [week1, setWeek1] = useState(checkins.find((c) => c.week_number === 1) || null);
  const unlocked = isCheckinComplete(week1);

  return (
    <div className="portal">
      <Styles />
      <Header />

      <section className="welcome">
        <h1>Congratulations.</h1>
        <p>
          You just took the first step toward your goal, a better relationship with food, and
          feeling good in your body again.
        </p>
        <p>
          Here's how this works: track one week below exactly how you normally eat, then hit
          "Get my plan" — your full plan, built off your real numbers instead of a guess. I'm
          around for a message any time.
        </p>
      </section>

      <StepHeader n={1} title="Track everything for a week." />
      <DiyCheckIn week1={week1} onSaved={setWeek1} />

      <StepHeader n={2} title="Your plan" locked={!unlocked} />
      {unlocked ? (
        <DiyPlan lead={lead} week1={week1} />
      ) : (
        <LockedCard note="Unlocks once you've logged at least 5 days and your weigh-in." />
      )}

      <section className="messages">
        <p className="eyebrow center">Message me</p>
        <MessageThread leadId={lead.id} role="client" initialMessages={initialMessages} />
      </section>
    </div>
  );
}

function DiyCheckIn({ week1, onSaved }) {
  const [weight, setWeight] = useState(week1?.weigh_in != null ? String(week1.weigh_in) : "");
  const [cal, setCal] = useState(
    week1?.calories ? week1.calories.map((c) => (c == null ? "" : String(c))) : Array(7).fill("")
  );
  const [mm, setMm] = useState(week1?.mymacros_email || "");
  const [status, setStatus] = useState("idle"); // idle | saving | error

  const updCal = (i, v) => setCal(cal.map((d, j) => (i === j ? v : d)));

  const nums = cal.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
  const avgC = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  const complete = nums.length >= 5 && weight;

  const save = async () => {
    setStatus("saving");
    const weighIn = weight ? parseFloat(weight) : null;
    const calories = cal.map((c) => (c === "" ? null : parseFloat(c)));
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber: 1, weighIn, calories, mymacrosEmail: mm || null }),
      });
      if (res.ok) {
        setStatus("idle");
        onSaved({ week_number: 1, weigh_in: weighIn, calories, mymacros_email: mm || null });
      } else {
        setStatus("error");
      }
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <section className="week1">
      <p className="lede center">
        Eat completely normal this week — don't change a thing. Just log it, honestly, every
        day, so your plan gets built off what you actually eat instead of a formula's guess.
      </p>

      <ol className="rules">
        <li>
          <strong>Log everything you eat, every day.</strong> Including the handful of almonds
          standing at the counter and the last three bites off someone else's plate. Nobody is
          looking at this but you — you're measuring it, not confessing it.
        </li>
        <li>
          <strong>Weigh in once, at the end of the week.</strong> Protocol below. One number,
          taken the same way every week, beats seven numbers taken however.
        </li>
        <li>
          <strong>Don't change a thing.</strong> Not portions, not workouts, not your Friday. A
          week you cleaned up for this doesn't actually tell you where you're starting from.
        </li>
        <li>
          <strong>Rough day? Log it anyway.</strong> The messy days are the data. Skipping them
          is the only real way to get this wrong.
        </li>
      </ol>

      <div className="protocol">
        <h3>How to weigh in</h3>
        <p>Same routine every single week or the number means nothing:</p>
        <ul>
          <li>In the morning, right after you wake up</li>
          <li>After you pee</li>
          <li>Before you eat or drink anything — water included</li>
          <li>Same clothes each week, or none</li>
        </ul>
        <p className="p-note">
          Weight swings two to four pounds in a day on water alone. Controlling the conditions
          is what turns it into a signal instead of a mood.
        </p>
      </div>

      <div className="checkin">
        <div className="ci-weight">
          <span className="flabel">This week's weigh-in</span>
          <div className="withunit">
            <input
              className="num big-num"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="—"
            />
            <span className="unit">lb</span>
          </div>
        </div>

        <div className="ci-cals">
          <span className="flabel">Calories, day by day</span>
          <div className="cal-grid">
            {DAYS.map((d, i) => (
              <label className="cal-cell" key={d}>
                <span>{d}</span>
                <input
                  className="num sm"
                  inputMode="numeric"
                  value={cal[i]}
                  onChange={(e) => updCal(i, e.target.value)}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <p className="ci-avg">
            Daily average <span className="mono">{avgC || "—"}</span>
          </p>
        </div>
      </div>

      <button className="cta" onClick={save} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : complete ? "Get my plan" : "Save"}
      </button>
      {status === "error" && (
        <p className="problem">
          That didn't save.{" "}
          <a href={supportMailto("My check-in didn't save")}>Screenshot this and email Liz instead</a>.
        </p>
      )}

      <div className="mmplus">
        <h3>Skip the manual logging</h3>
        <p>
          If you track in My Macros+, connect it and your daily numbers come in automatically —
          no filling in this table.
        </p>
        <ol className="mm-steps">
          <li>Open My Macros+ and go to My Circle</li>
          <li>Add Liz as your coach using the email she sent you</li>
          <li>Drop your My Macros+ email below so it can find you</li>
        </ol>
        <div className="withunit">
          <input
            className="txt"
            value={mm}
            onChange={(e) => setMm(e.target.value)}
            placeholder="your My Macros+ email"
          />
        </div>
        <p className="attrib">Macros Powered by My Macros+</p>
      </div>
    </section>
  );
}

// What each phase's row says in the timeline — calories plus a short
// plain-language description. No per-block macro breakdown here: protein
// and fiber stay constant across the whole plan (shown once, up top),
// and fat/carbs move with calories in a way the "How I got here" section
// already explains — repeating the full split on every row would just be
// noise.
function phaseWhatHappens(p, plan) {
  if (p.kind === "cut" || p.kind === "gain") {
    const rate = expectedRateRange(plan.weeklyLbs);
    return `${plan.cutCals.toLocaleString()} cal. Expect ${rate.low}–${rate.high} lb/week; ~${plan.weeklyLbs.toFixed(1)} lb/week average`;
  }
  if (p.kind === "break") {
    return `${p.weeks} week${p.weeks > 1 ? "s" : ""} at ~${plan.tdee.toLocaleString()} cal (your real maintenance) — built in since this deficit runs past ~3 months`;
  }
  if (p.kind === "reverse") return reverseChainLabel(plan);
  if (p.kind === "hold") return `Hold at ~${plan.goalTdee.toLocaleString()} cal for at least 8 weeks before any new deficit`;
  return "";
}

function buildPlanEmail(lead, plan, rows, macros, rules) {
  const lines = [
    `Your One-Time Macro Plan — ${lead.name || ""}`,
    `${lead.form?.weight} lb → ${lead.form?.goal} lb`,
    "",
    "YOUR NUMBERS",
    `Calories: ${plan.cutCals} (${plan.cutCals - 25}–${plan.cutCals + 25})`,
    `Protein: ${macros.proteinG}g (${macros.proteinG - 5}–${macros.proteinG + 5}g) — hit this`,
    `Fat: ${macros.fatG}g (${macros.fatG - 5}–${macros.fatG + 5}g) — stay near this`,
    `Carbs: ${macros.carbsG}g (${macros.carbsG - 5}–${macros.carbsG + 5}g) — fill the rest`,
    `Fiber: ${macros.fiberG}g minimum`,
    "",
    "YOUR TIMELINE",
    ...rows.map((r) => `${r.label} (weeks ${r.weekStart}-${r.weekEnd}): ${phaseWhatHappens(r, plan)}`),
    "",
    `Realistic finish: ~${plan.dietingWeeks + plan.reverseWeeks} weeks to ${lead.form?.goal} lb and holding it.`,
    "",
    "RULES FOR THE NEXT FEW WEEKS",
    ...rules.weeklyRules.map((r, i) => `${i + 1}. ${r}`),
    "",
    "WHEN TO CHANGE SOMETHING",
    ...rules.changeRules.map((r) => `- ${r}`),
    "",
    rules.doneText,
  ];
  return `mailto:?subject=${encodeURIComponent("My macro plan")}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function NumberCard({ k, v, u, range, note }) {
  return (
    <div className="numcard">
      <span className="s-k">{k}</span>
      <span className="s-v">
        {v}
        <span className="s-u"> {u}</span>
      </span>
      {range && <span className="s-range">{range}</span>}
      {note && <span className="s-note">{note}</span>}
    </div>
  );
}

function DiyPlan({ lead, week1 }) {
  const realTdee = avgCalories(week1);
  const plan = computePlan(lead.form || {}, { realTdee, simpleDietBreaks: true, ageAdjustedTdee: true });
  if (!plan.ok) return <p className="lede center">Your plan will show up here once week one is in.</p>;

  const f = lead.form || {};
  const female = f.sex !== "male";
  const macros = computeMacros(f, plan.cutCals);
  const rules = planRules(lead, plan);
  const rate = expectedRateRange(plan.weeklyLbs);
  const fatPct = Math.round(((macros.fatG * 9) / plan.cutCals) * 100);
  const proteinPerLb = (macros.proteinG / (+f.goal || 1)).toFixed(2);

  const start = new Date(lead.start_date + "T00:00:00");
  // The formula's "baseline week" phase is the week they just finished in
  // Step 1 above — showing it again here as an upcoming row would just
  // duplicate that. Its week still counts toward the numbering below;
  // it's only left out of what's rendered. Week numbers count from the
  // day the real plan starts (right after baseline), not from day one.
  const rows = plan.phases
    .reduce((acc, p) => {
      const priorWeeks = acc.length ? acc[acc.length - 1].weeksAcc : 0;
      const weeksAcc = priorWeeks + p.weeks;
      acc.push({ ...p, start: addWeeks(start, priorWeeks), end: addWeeks(start, weeksAcc), weeksAcc, weekStart: priorWeeks, weekEnd: weeksAcc - 1 });
      return acc;
    }, [])
    .filter((p) => p.kind !== "baseline");

  return (
    <section className="plan-doc">
      <header className="doc-head">
        <h2>Your One-Time Macro Plan</h2>
        <p>
          {lead.name || "You"} · Age {f.age} · {f.weight} lb → {f.goal} lb
        </p>
      </header>

      <h3 className="doc-h3">Your numbers</h3>
      <div className="numgrid">
        <NumberCard k="Calories" v={plan.cutCals.toLocaleString()} range={`${plan.cutCals - 25}–${plan.cutCals + 25}`} />
        <NumberCard k="Protein" v={macros.proteinG} u="g" range={`${macros.proteinG - 5}–${macros.proteinG + 5}g`} note="hit this" />
        <NumberCard k="Fat" v={macros.fatG} u="g" range={`${macros.fatG - 5}–${macros.fatG + 5}g`} note="stay near this" />
        <NumberCard k="Carbs" v={macros.carbsG} u="g" range={`${macros.carbsG - 5}–${macros.carbsG + 5}g`} note="fill the rest" />
        <NumberCard k="Fiber" v={macros.fiberG} u="g" note="minimum" />
      </div>
      <p className="doc-line">
        <strong>Steps:</strong> add about 2,000 to your normal daily average.
      </p>
      <p className="doc-line">
        <strong>Training:</strong> strength train 2–3x/week, non-negotiable — this is what makes the loss come
        from fat instead of muscle.
      </p>

      <h3 className="doc-h3">How I got here</h3>
      <ul className="doc-list">
        <li>
          {realTdee ? "Real" : "Estimated"} maintenance: ~{plan.tdee.toLocaleString()} calories
          {realTdee ? " — pulled from the week you tracked, not a formula guess" : " (formula estimate)"}
        </li>
        <li>Deficit: {Math.round(((plan.tdee - plan.cutCals) / plan.tdee) * 100)}% below maintenance</li>
        <li>
          Protein: {proteinPerLb} g per lb of goal weight ({f.goal})
          {(+f.age || 0) >= 30 ? ", upper end of the range" : ""}
        </li>
        <li>
          Fat: {fatPct}% of calories, above the {female ? 45 : 50}g floor{female ? " that protects your cycle" : ""}
        </li>
        <li>Carbs: whatever's left, comfortably above the 100g floor</li>
      </ul>

      <h3 className="doc-h3">Your timeline</h3>
      <div className="timeline-table">
        <div className="tt-head">
          <span>Phase</span>
          <span>Weeks</span>
          <span>What happens</span>
        </div>
        {rows.map((r) => (
          <div className="tt-row" key={r.key}>
            <span className="tt-phase">{r.label}</span>
            <span className="tt-weeks">{r.weekStart === r.weekEnd ? r.weekStart : `${r.weekStart}–${r.weekEnd}`}</span>
            <span className="tt-desc">{phaseWhatHappens(r, plan)}</span>
          </div>
        ))}
      </div>
      <p className="finish-callout">
        <strong>Realistic finish: ~{plan.dietingWeeks + plan.reverseWeeks} weeks to {f.goal} lb and holding it.</strong>{" "}
        The reverse isn't optional — it's the difference between getting there once and getting there for good.
      </p>

      <div className="doc-pagebreak" />

      <h3 className="doc-h3">Rules for the next few weeks</h3>
      <ol className="doc-list numbered">
        {rules.weeklyRules.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>

      <h3 className="doc-h3">When to change something</h3>
      <ul className="doc-list">
        {rules.changeRules.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <h3 className="doc-h3">What "done" looks like</h3>
      <p className="doc-line">{rules.doneText}</p>

      <div className="plan-actions">
        <a className="cta small" href={buildPlanEmail(lead, plan, rows, macros, rules)}>
          Email me my plan
        </a>
        <button className="cta small ghost" onClick={() => window.print()}>
          Print my plan
        </button>
      </div>
    </section>
  );
}

/* ============================ Coached ============================ */

function CoachedPortal({ lead, checkins, initialMessages, bookingUrl }) {
  const [checkinsState, setCheckinsState] = useState(checkins);
  const week1 = checkinsState.find((c) => c.week_number === 1);
  // Once week one's logged, swap the formula guess for the client's real
  // average intake — the unlock copy below promises exactly this.
  const plan = computePlan(lead.form || {}, { realTdee: avgCalories(week1) });
  const totalWeeks = plan.ok ? plan.totalWeeks : null;
  const currentWeek = totalWeeks ? currentWeekNumber(lead.start_date, totalWeeks) : 1;
  const existing = checkinsState.find((c) => c.week_number === currentWeek);
  const unlocked = isCheckinComplete(week1);

  const onCheckinSaved = (row) => {
    setCheckinsState((prev) => {
      const next = prev.filter((c) => c.week_number !== row.week_number);
      next.push(row);
      return next;
    });
  };

  return (
    <div className="portal">
      <Styles />
      <Header />

      <section className="welcome">
        <h1>Congratulations.</h1>
        <p>
          You just took the first step toward your goal, a better relationship with food, and
          feeling good in your body again.
        </p>
        <p>
          Here's how this works: finish week one below and your call and your plan both unlock.
          Book that call once you're done — that's when we walk through your plan together. I'm
          around for a message any time in the meantime, no need to wait.
        </p>
      </section>

      <StepHeader n={1} title={currentWeek === 1 ? "Change nothing. Just watch." : "Your weekly check-in."} />
      <CheckIn
        plan={plan}
        formulaTdee={computePlan(lead.form || {}).tdee}
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        existing={existing}
        onSaved={onCheckinSaved}
      />

      <StepHeader n={2} title="Book your call" locked={!unlocked} />
      {unlocked ? (
        <section className="booking">
          <div className="booking-frame">
            <iframe src={bookingUrl} title="Book a call" loading="lazy" />
          </div>
        </section>
      ) : (
        <LockedCard note="Unlocks once you've logged at least 5 days and your weigh-in for week one." />
      )}

      <StepHeader n={3} title="Your plan" locked={!unlocked} />
      {unlocked ? (
        <CoachedPlan macroTargets={lead.macro_targets} />
      ) : (
        <LockedCard note="Unlocks once week one's done — that's when your plan is ready to land here." />
      )}

      <ProgressPhotoUpload />

      <section className="messages">
        <p className="eyebrow center">Message me</p>
        <MessageThread leadId={lead.id} role="client" initialMessages={initialMessages} />
      </section>
    </div>
  );
}

function ProgressPhotoUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error

  const upload = async () => {
    if (!file) return;
    setStatus("uploading");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/photos", { method: "POST", body: form });
      if (res.ok) {
        setStatus("done");
        setFile(null);
      } else {
        setStatus("error");
      }
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <section className="photos">
      <p className="eyebrow center">Progress photo</p>
      <h2 className="ph2">Once a month is plenty</h2>
      <p className="lede center">
        No need to time it to a check-in — just drop one whenever. I'll go over it on our next call
        or message you if anything stands out.
      </p>
      <div className="photo-upload">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setStatus("idle");
          }}
        />
        <button className="cta small" onClick={upload} disabled={!file || status === "uploading"}>
          {status === "uploading" ? "Uploading…" : "Upload photo"}
        </button>
      </div>
      {status === "done" && <p className="hint">Uploaded — thanks!</p>}
      {status === "error" && (
        <p className="problem">
          That didn't upload. Try again, or{" "}
          <a href={supportMailto("My progress photo didn't upload", "Photo attached.")}>email it to Liz instead</a>.
        </p>
      )}
    </section>
  );
}

function CoachedPlan({ macroTargets }) {
  if (!macroTargets) {
    return (
      <section className="plan-section">
        <p className="lede center">
          Your plan's being built — usually ready within a day. I'll message you the moment it's up.
        </p>
      </section>
    );
  }
  return (
    <section className="plan-section">
      <div className="stats">
        <Stat k="Protein" v={macroTargets.protein} u="g" />
        <Stat k="Carbs" v={macroTargets.carbs} u="g" />
        <Stat k="Fat" v={macroTargets.fat} u="g" />
      </div>
    </section>
  );
}

function CheckIn({ plan, formulaTdee, currentWeek, totalWeeks, existing, onSaved }) {
  const [weight, setWeight] = useState(existing?.weigh_in != null ? String(existing.weigh_in) : "");
  const [cal, setCal] = useState(
    existing?.calories ? existing.calories.map((c) => (c == null ? "" : String(c))) : Array(7).fill("")
  );
  const [protein, setProtein] = useState(
    existing?.protein ? existing.protein.map((p) => (p == null ? "" : String(p))) : Array(7).fill("")
  );
  const [mm, setMm] = useState(existing?.mymacros_email || "");
  const [saved, setSaved] = useState(false);

  const updCal = (i, v) => {
    setCal(cal.map((d, j) => (i === j ? v : d)));
    setSaved(false);
  };
  const updProtein = (i, v) => {
    setProtein(protein.map((d, j) => (i === j ? v : d)));
    setSaved(false);
  };

  const save = async () => {
    const weighIn = weight ? parseFloat(weight) : null;
    const calories = cal.map((c) => (c === "" ? null : parseFloat(c)));
    const proteinLog = protein.map((p) => (p === "" ? null : parseFloat(p)));
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber: currentWeek, weighIn, calories, protein: proteinLog, mymacrosEmail: mm || null }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved({ week_number: currentWeek, weigh_in: weighIn, calories, protein: proteinLog, mymacros_email: mm || null });
      } else {
        setSaved("error");
      }
    } catch (e) {
      setSaved("error");
    }
  };

  const nums = cal.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
  const avgC = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  const complete = nums.length >= 5 && weight;
  const isBaseline = currentWeek === 1;

  return (
    <section className="week1">
      <p className="eyebrow center">
        Week {currentWeek} of {totalWeeks || "—"}
      </p>

      {isBaseline ? (
        <>
          <p className="lede center">
            Every number on your timeline came out of a formula, and formulas are wrong by two
            or three hundred calories all the time. This week swaps the estimate for your
            actual data. Everything after it gets built on what we find, which is why this is
            the one week you don't try.
          </p>

          <ol className="rules">
            <li>
              <strong>Log everything you eat, every day.</strong> Including the handful of
              almonds standing at the counter and the last three bites off someone else's
              plate. Nobody is looking at this but me, and I'm not judging it — I'm measuring it.
            </li>
            <li>
              <strong>Weigh in once, at the end of the week.</strong> Protocol below. One
              number, taken the same way every week, beats seven numbers taken however.
            </li>
            <li>
              <strong>Don't change a thing.</strong> Not portions, not workouts, not your
              Friday. A baseline you cleaned up for one week is a baseline that lies to you in
              week six and makes us undo it.
            </li>
            <li>
              <strong>Rough week? Log it anyway.</strong> The messy days are the data. Skipping
              them is the only real way to get this wrong.
            </li>
          </ol>

          <div className="protocol">
            <h3>How to weigh in</h3>
            <p>Same routine every single week or the number means nothing:</p>
            <ul>
              <li>In the morning, right after you wake up</li>
              <li>After you pee</li>
              <li>Before you eat or drink anything — water included</li>
              <li>Same clothes each week, or none</li>
            </ul>
            <p className="p-note">
              Weight swings two to four pounds in a day on water alone. Controlling the
              conditions is what turns it into a signal instead of a mood.
            </p>
          </div>
        </>
      ) : (
        <p className="lede center">One weigh-in, your calories day by day. Same as always.</p>
      )}

      <div className="checkin">
        <div className="ci-weight">
          <span className="flabel">This week's weigh-in</span>
          <div className="withunit">
            <input
              className="num big-num"
              inputMode="decimal"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setSaved(false);
              }}
              placeholder="—"
            />
            <span className="unit">lb</span>
          </div>
        </div>

        <div className="ci-cals">
          <span className="flabel">Calories, day by day</span>
          <div className="cal-grid">
            {DAYS.map((d, i) => (
              <label className="cal-cell" key={d}>
                <span>{d}</span>
                <input
                  className="num sm"
                  inputMode="numeric"
                  value={cal[i]}
                  onChange={(e) => updCal(i, e.target.value)}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <p className="ci-avg">
            Daily average <span className="mono">{avgC || "—"}</span>
          </p>
        </div>

        <div className="ci-cals">
          <span className="flabel">Protein, day by day (grams)</span>
          <div className="cal-grid">
            {DAYS.map((d, i) => (
              <label className="cal-cell" key={d}>
                <span>{d}</span>
                <input
                  className="num sm"
                  inputMode="numeric"
                  value={protein[i]}
                  onChange={(e) => updProtein(i, e.target.value)}
                  placeholder="—"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <button className="cta" onClick={save}>
        {saved === true ? "Saved" : "Save my check-in"}
      </button>
      {saved === "error" && (
        <p className="problem">
          That didn't save.{" "}
          <a href={supportMailto("My check-in didn't save")}>Screenshot this and email it to me instead</a>.
        </p>
      )}

      {isBaseline && (
        <div className={"unlock " + (complete ? "ready" : "")}>
          <h3>{complete ? "Nice — that unlocks the rest" : "5 days + your weigh-in unlocks the rest"}</h3>
          <p>
            {complete
              ? `Your real maintenance is sitting around ${avgC} calories — not the ${formulaTdee} the calculator guessed. Your call and your plan are open below now.`
              : `Fill in at least five days and your weigh-in, and your call booking and your plan both open up below — set from your real maintenance, not an estimate.`}
          </p>
        </div>
      )}

      <div className="mmplus">
        <h3>Skip the manual logging</h3>
        <p>
          If you track in My Macros+, connect it and your daily numbers come to me
          automatically — no screenshots, no filling in this table every Sunday.
        </p>
        <ol className="mm-steps">
          <li>Open My Macros+ and go to My Circle</li>
          <li>Add me as your coach using the email I sent you</li>
          <li>Drop your My Macros+ email below so I can find you</li>
        </ol>
        <div className="withunit">
          <input
            className="txt"
            value={mm}
            onChange={(e) => {
              setMm(e.target.value);
              setSaved(false);
            }}
            placeholder="your My Macros+ email"
          />
        </div>
        <p className="attrib">Macros Powered by My Macros+</p>
      </div>
    </section>
  );
}

function Styles() {
  return (
    <style>{`
.portal{background:var(--ink);color:var(--chalk);font-family:var(--body);min-height:100vh;padding:0 20px 80px;line-height:1.55}
.portal *{box-sizing:border-box}
.portal button:focus-visible,.portal input:focus-visible,.portal textarea:focus-visible{outline:2px solid var(--sage);outline-offset:2px}

.p-head{max-width:700px;margin:0 auto;padding:26px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--edge)}
.mark{font-family:var(--display);font-size:19px}
.signout{background:none;border:0;color:var(--mute);font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;padding:0}

.welcome{max-width:700px;margin:40px auto 0;text-align:center}
.welcome h1{font-family:var(--display);font-weight:600;font-size:clamp(28px,5vw,40px);margin:0 0 16px;letter-spacing:-.02em}
.welcome p{color:var(--mute);font-size:15.5px;line-height:1.6;max-width:56ch;margin:0 auto 10px}

.step-head{max-width:700px;margin:56px auto 0}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sage);margin:0 0 14px}
.eyebrow.center{text-align:center}
.ph2{font-family:var(--display);font-weight:600;font-size:clamp(26px,4.5vw,38px);line-height:1.1;text-align:center;margin:0 auto 20px;max-width:20ch;letter-spacing:-.02em}
.lede.center{color:var(--mute);max-width:56ch;margin:0 auto 30px;text-align:center;font-size:15.5px}

.locked-card{max-width:700px;margin:0 auto;background:var(--tide);border:1px dashed var(--edge-lit);border-radius:4px;padding:24px;text-align:center}
.locked-card p{margin:0;color:var(--mute);font-size:14.5px}

.week1{max-width:700px;margin:0 auto}
.rules{counter-reset:r;list-style:none;padding:0;margin:0 0 34px}
.rules li{counter-increment:r;position:relative;padding-left:40px;margin-bottom:18px;font-size:15px;color:#4A4550;line-height:1.5}
.rules li:before{content:counter(r,decimal-leading-zero);position:absolute;left:0;top:1px;font-family:var(--mono);font-size:12px;color:var(--sage)}
.rules strong{color:var(--chalk);font-weight:700}

.protocol{background:var(--tide);border-left:2px solid var(--sage);border-radius:2px;padding:20px 22px;margin-bottom:26px}
.protocol h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.protocol p{margin:0 0 10px;font-size:14.5px;color:#4A4550}
.protocol ul{margin:0 0 12px;padding-left:0;list-style:none}
.protocol li{position:relative;padding-left:18px;margin-bottom:6px;font-size:14.5px;color:var(--chalk)}
.protocol li:before{content:"";position:absolute;left:0;top:10px;width:8px;height:1px;background:var(--sage)}
.p-note{font-size:13px !important;color:var(--mute) !important;margin-bottom:0 !important}

.checkin{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px;margin-bottom:20px}
.ci-weight{padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid var(--edge)}
.flabel{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-bottom:9px}
.num{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--mono);font-size:19px;padding:11px 12px;border-radius:3px;width:100%}
.big-num{font-size:30px !important;max-width:170px;text-align:center}
.withunit{display:flex;align-items:center;gap:8px}
.unit{font-family:var(--mono);font-size:12px;color:var(--mute)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal-cell{display:flex;flex-direction:column;gap:5px;text-align:center}
.cal-cell span{font-family:var(--mono);font-size:10px;color:var(--mute)}
.cal-cell .num.sm{width:100%;font-size:14px;padding:9px 2px}
.ci-avg{font-family:var(--mono);font-size:12px;color:var(--mute);margin:14px 0 0;text-align:right}
.ci-avg .mono{color:var(--sage);font-size:15px;margin-left:6px}

.cta{width:100%;background:var(--gold);color:#FFFFFF;border:0;border-radius:3px;padding:16px;font-family:var(--body);font-weight:700;font-size:15px;cursor:pointer}
.cta:disabled{opacity:.6;cursor:default}
.cta.small{width:auto;display:inline-block;padding:12px 18px;font-size:13.5px;text-align:center;text-decoration:none}
.cta.ghost{background:transparent;border:1px solid var(--gold);color:var(--gold)}
.problem{color:var(--rose);font-size:14px;margin:16px 0 0}
.problem a{color:var(--rose);text-decoration:underline}
.hint{color:var(--sage);font-size:14px;margin:16px 0 0}

.photos{max-width:700px;margin:56px auto 0}
.photo-upload{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;margin-bottom:6px}
.photo-upload input{font-family:var(--body);font-size:13px;color:var(--mute)}

.unlock{margin-top:30px;border:1px dashed var(--edge-lit);border-radius:4px;padding:20px}
.unlock.ready{border-style:solid;border-color:var(--sage);background:#E3FBF7}
.unlock h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.unlock p{margin:0;font-size:14px;color:#4A4550}

.mmplus{margin-top:22px;background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px}
.mmplus h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.mmplus p{font-size:14px;color:#4A4550;margin:0 0 14px;line-height:1.5}
.mm-steps{counter-reset:m;list-style:none;padding:0;margin:0 0 16px}
.mm-steps li{counter-increment:m;position:relative;padding-left:26px;margin-bottom:7px;font-size:14px;color:var(--chalk)}
.mm-steps li:before{content:counter(m);position:absolute;left:0;top:0;font-family:var(--mono);font-size:11px;color:var(--sage)}
.txt{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-size:15px;padding:12px;border-radius:3px;width:100%}
.attrib{font-family:var(--mono) !important;font-size:10px !important;color:var(--mute) !important;letter-spacing:.08em;margin:14px 0 0 !important;text-align:right}

.booking{max-width:700px;margin:0 auto}
.booking-frame{border:1px solid var(--edge);border-radius:4px;overflow:hidden;background:var(--tide)}
.booking-frame iframe{width:100%;height:680px;border:0;display:block}

.plan-section{max-width:700px;margin:0 auto}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--edge);border:1px solid var(--edge);margin-bottom:20px}
.stat{background:var(--tide);padding:16px}
.s-k{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.s-v{display:block;font-family:var(--display);font-size:30px;font-weight:600;margin-top:6px;line-height:1}
.s-u{font-family:var(--mono);font-size:11px;color:var(--mute)}
.micro{font-family:var(--mono);font-size:11px;color:var(--mute);margin:16px 0 0}
.plan-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}

.messages{max-width:700px;margin:56px auto 0}

/* --- Plan document (DIY's "Your One-Time Macro Plan") --- */
.plan-doc{max-width:700px;margin:0 auto}
.doc-head{margin-bottom:28px}
.doc-head h2{font-family:var(--display);font-weight:600;font-size:clamp(26px,4.5vw,34px);margin:0 0 6px;letter-spacing:-.02em}
.doc-head p{font-family:var(--mono);font-size:13px;color:var(--mute);margin:0}
.doc-h3{font-family:var(--display);font-weight:600;font-size:19px;margin:34px 0 14px}
.doc-h3:first-of-type{margin-top:0}

.numgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:1px;background:var(--edge);border:1px solid var(--edge);margin-bottom:18px}
.numcard{background:var(--tide);padding:14px}
.numcard .s-v{display:block;font-family:var(--display);font-size:26px;font-weight:600;margin-top:6px;line-height:1}
.numcard .s-u{font-family:var(--mono);font-size:11px;color:var(--mute);font-weight:400}
.s-range{display:block;font-family:var(--mono);font-size:11px;color:var(--mute);margin-top:6px}
.s-note{display:block;font-family:var(--mono);font-size:10.5px;color:var(--sage);margin-top:2px}

.doc-line{font-size:14.5px;color:#4A4550;margin:0 0 8px;line-height:1.55}
.doc-list{margin:0;padding-left:0;list-style:none}
.doc-list li{position:relative;padding-left:18px;margin-bottom:10px;font-size:14.5px;color:#4A4550;line-height:1.5}
.doc-list li:before{content:"";position:absolute;left:0;top:9px;width:8px;height:1px;background:var(--sage)}
.doc-list.numbered{counter-reset:dl}
.doc-list.numbered li{counter-increment:dl;padding-left:26px}
.doc-list.numbered li:before{content:counter(dl) ".";width:auto;height:auto;background:none;font-family:var(--mono);font-size:12px;color:var(--sage);top:0}

.timeline-table{border-top:1px solid var(--edge)}
.tt-head{display:none}
.tt-row{display:grid;grid-template-columns:140px 64px 1fr;gap:14px;padding:12px 2px;border-bottom:1px solid var(--edge);font-size:14px;align-items:baseline}
.tt-phase{font-weight:600}
.tt-weeks{font-family:var(--mono);font-size:12px;color:var(--mute)}
.tt-desc{font-size:13.5px;color:#4A4550;line-height:1.5}
.finish-callout{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:18px 20px;margin:20px 0 0;font-size:14px;color:#4A4550;line-height:1.55}

.doc-pagebreak{display:none}

@media (max-width:560px){
  .cal-grid{grid-template-columns:repeat(4,1fr)}
  .booking-frame iframe{height:560px}
  .tt-row{grid-template-columns:1fr;gap:4px}
}

@media print{
  .p-head,.welcome,.step-head,.messages,.plan-actions,.signout,.week1,.mmplus{display:none}
  .plan-doc{max-width:none}
  .doc-pagebreak{display:block;break-before:page}
}
    `}</style>
  );
}
