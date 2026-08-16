import React, { useState, useEffect, useMemo, useRef } from "react";

/* ------------------------------------------------------------------
   PHASE PLAN — v1
   Free timeline calculator -> "I'm ready" -> paywall -> week 1 baseline
   Swap the PRICES object + COACH strings and it's yours.
-------------------------------------------------------------------*/

const COACH = {
  name: "Macro Coaching With Liz",
  tagline: "No BS. No guesswork. Real timelines and results that stick.",
};

const PRICES = {
  diy: { amount: "$89", cadence: "one time" },
  m1: { amount: "$249", cadence: "per month" },
  m3: { amount: "$199", cadence: "per month · 3 months" },
  m6: { amount: "$169", cadence: "per month · 6 months" },
};

const TIER_NAMES = {
  diy: "Do it yourself",
  m1: "One month",
  m3: "Three months",
  m6: "Six months",
};

// Paste your Stripe Payment Link for each tier. Empty = demo mode (skips payment).
const STRIPE_LINKS = {
  diy: "",
  m1: "",
  m3: "",
  m6: "",
};

const ACTIVITY = [
  { key: "sed", label: "Mostly seated", note: "Desk job, little formal exercise", mult: 1.2 },
  { key: "light", label: "Lightly active", note: "Walking daily, training 1–3x", mult: 1.375 },
  { key: "mod", label: "Active", note: "Training 3–5x, on your feet a lot", mult: 1.55 },
  { key: "high", label: "Very active", note: "Training 6x+, physical job", mult: 1.725 },
];

const KIND_COLOR = {
  baseline: "var(--mute)",
  cut: "var(--sage)",
  gain: "var(--sage)",
  break: "var(--edge-lit)",
  reverse: "var(--gold)",
  hold: "var(--gold)",
};

/* ---------------------------- the math ---------------------------- */

function computePlan(f) {
  const age = +f.age;
  const wt = +f.weight;
  const goal = +f.goal;
  const inches = +f.ft * 12 + +f.inch;

  if (!age || !wt || !goal || !inches) return { ok: false, reason: "incomplete" };
  if (age < 16 || age > 90) return { ok: false, reason: "age" };

  const kg = wt * 0.453592;
  const cm = inches * 2.54;
  const goalBmi = (goal / (inches * inches)) * 703;
  const delta = goal - wt;

  if (Math.abs(delta) < 2)
    return { ok: false, reason: "already-there" };

  if (delta < 0 && goalBmi < 18.5)
    return { ok: false, reason: "floor", goalBmi };

  const bmr =
    f.sex === "male"
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161;
  const mult = ACTIVITY.find((a) => a.key === f.activity).mult;
  const tdee = bmr * mult;

  // maintenance once they're at goal weight
  const goalKg = goal * 0.453592;
  const goalBmr =
    f.sex === "male"
      ? 10 * goalKg + 6.25 * cm - 5 * age + 5
      : 10 * goalKg + 6.25 * cm - 5 * age - 161;
  const goalTdee = goalBmr * mult;

  const midpoint = (wt + goal) / 2;
  const losing = delta < 0;
  const totalLbs = Math.abs(delta);

  const phases = [{ key: "baseline", label: "Baseline week", weeks: 1, kind: "baseline" }];
  let notes = [];

  if (losing) {
    // 0.7% of bodyweight per week is the sustainable band (0.5–1%)
    let weeklyLbs = midpoint * 0.007;
    let dailyDeficit = (weeklyLbs * 3500) / 7;

    // never cut more than 25% below maintenance
    const maxDeficit = tdee * 0.25;
    if (dailyDeficit > maxDeficit) {
      dailyDeficit = maxDeficit;
      notes.push("Rate capped at 25% below maintenance — deeper than that and you lose muscle, not just fat.");
    }

    // hard calorie floor
    const floor = Math.max(bmr * 1.05, f.sex === "male" ? 1500 : 1200);
    let cutCals = tdee - dailyDeficit;
    if (cutCals < floor) {
      cutCals = floor;
      dailyDeficit = tdee - floor;
      notes.push(`Calories held at ${Math.round(floor)} — this plan won't go below your floor, so it runs longer instead.`);
    }

    weeklyLbs = (dailyDeficit * 7) / 3500;
    const cutWeeks = Math.ceil(totalLbs / weeklyLbs);

    // one maintenance week per 8 weeks of dieting
    const breaks = Math.floor(cutWeeks / 8);
    const segment = breaks > 0 ? Math.round(cutWeeks / (breaks + 1)) : cutWeeks;

    let placed = 0;
    for (let i = 0; i <= breaks; i++) {
      const w = i === breaks ? cutWeeks - placed : segment;
      if (w > 0) {
        phases.push({ key: `cut${i}`, label: breaks ? `Deficit block ${i + 1}` : "Deficit", weeks: w, kind: "cut" });
        placed += w;
      }
      if (i < breaks) phases.push({ key: `brk${i}`, label: "Diet break", weeks: 1, kind: "break" });
    }

    const reverseWeeks = Math.min(16, Math.max(4, Math.round((goalTdee - cutCals) / 75)));
    phases.push({ key: "rev", label: "Reverse diet", weeks: reverseWeeks, kind: "reverse" });

    return {
      ok: true,
      losing: true,
      phases,
      notes,
      totalLbs,
      weeklyLbs,
      tdee: Math.round(tdee),
      cutCals: Math.round(cutCals),
      goalTdee: Math.round(goalTdee),
      dietingWeeks: cutWeeks + breaks,
      reverseWeeks,
      totalWeeks: phases.reduce((s, p) => s + p.weeks, 0),
    };
  }

  // gaining
  const weeklyLbs = midpoint * 0.0035;
  const surplus = (weeklyLbs * 3500) / 7;
  const gainWeeks = Math.ceil(totalLbs / weeklyLbs);
  phases.push({ key: "gain", label: "Surplus", weeks: gainWeeks, kind: "gain" });
  phases.push({ key: "hold", label: "Maintenance hold", weeks: 6, kind: "hold" });

  return {
    ok: true,
    losing: false,
    phases,
    notes: ["Gaining slowly is the whole trick — faster than this and most of it isn't muscle."],
    totalLbs,
    weeklyLbs,
    tdee: Math.round(tdee),
    cutCals: Math.round(tdee + surplus),
    goalTdee: Math.round(goalTdee),
    dietingWeeks: gainWeeks,
    reverseWeeks: 6,
    totalWeeks: phases.reduce((s, p) => s + p.weeks, 0),
  };
}

/* ---------------------------- helpers ---------------------------- */

const addWeeks = (d, w) => {
  const n = new Date(d);
  n.setDate(n.getDate() + w * 7);
  return n;
};
const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* ---------------------------- app ---------------------------- */

export default function App() {
  const [step, setStep] = useState("calc");
  const [form, setForm] = useState({
    sex: "female",
    age: "",
    ft: "5",
    inch: "5",
    weight: "",
    goal: "",
    activity: "light",
  });
  const [plan, setPlan] = useState(null);
  const [tier, setTier] = useState(null);
  const [leadId, setLeadId] = useState(null);
  const planRef = useRef(null);

  // Persisted at every step, not just after payment — so someone who computes
  // a timeline, picks a tier, or bails mid-checkout doesn't lose it on reload.
  // leadId is the anchor: it's generated the moment they have a real plan and
  // gets passed to Stripe as client_reference_id so the webhook can match the
  // payment back to this record without relying on the email staying identical.
  const save = async (data) => {
    try {
      await window.storage.set("phaseplan:client", JSON.stringify(data));
    } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("phaseplan:client");
        if (!saved) return;
        const v = JSON.parse(saved.value);
        if (v.form) setForm(v.form);
        if (v.leadId) setLeadId(v.leadId);
        if (v.paid) {
          setTier(v.tier);
          setPlan(computePlan(v.form));
          setStep("start");
        } else if (v.tier) {
          setTier(v.tier);
          setPlan(computePlan(v.form));
          setStep("checkout");
        } else if (v.form) {
          const p = computePlan(v.form);
          if (p.ok) {
            setPlan(p);
            setStep("plan");
          }
        }
      } catch (e) {
        /* first visit */
      }
    })();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = () => {
    const p = computePlan(form);
    setPlan(p);
    if (p.ok) {
      const id = leadId || (crypto.randomUUID ? crypto.randomUUID() : `lead_${Date.now()}`);
      setLeadId(id);
      setStep("plan");
      save({ leadId: id, form, tier: null, paid: false });
      setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  };

  const choose = (t) => {
    setTier(t);
    setStep("checkout");
    save({ leadId, form, tier: t, paid: false });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  const paid = async () => {
    setStep("start");
    await save({ leadId, form, tier, paid: true });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  return (
    <div className="pp">
      <Styles />

      <header className="masthead">
        <span className="mark">{COACH.name}</span>
        <span className="mark-note">{COACH.tagline}</span>
      </header>


      {step === "calc" || step === "plan" ? (
        <>
          <section className="hero">
            <h1>Start here.</h1>
            <p className="hero-sub">
              Let's talk about <em>realistic</em> goals.
            </p>
            <div className="lede">
              <p>
                So much of this industry sells you ambiguity. Big feelings, lots of
                optimism, no actual end in sight — and that's not an accident. The longer
                you need a coach, the more that coach makes. It's a business model, and
                it works best when you never quite arrive.
              </p>
              <p>
                That's not what I'm selling. I want you to hit your goal and then get on
                with your life at a weight you can actually hold. Not six months of eating
                like a bird followed by a flip right back to where you started, plus
                interest.
              </p>
              <p>
                So we start with your goals. I'll tell you exactly when you can expect to
                be there — and then how to train your metabolism to eat <em>more</em> while
                you keep the result. <ReverseLink />
              </p>
            </div>
          </section>

          <section className="card form">
            <div className="row">
              <Field label="You are">
                <div className="seg">
                  {["female", "male"].map((s) => (
                    <button
                      key={s}
                      className={form.sex === s ? "on" : ""}
                      onClick={() => setForm({ ...form, sex: s })}
                    >
                      {s === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Age">
                <input className="num" inputMode="numeric" value={form.age} onChange={set("age")} placeholder="34" />
              </Field>
            </div>

            <div className="row">
              <Field label="Height">
                <div className="height">
                  <input className="num sm" inputMode="numeric" value={form.ft} onChange={set("ft")} />
                  <span className="unit">ft</span>
                  <input className="num sm" inputMode="numeric" value={form.inch} onChange={set("inch")} />
                  <span className="unit">in</span>
                </div>
              </Field>
            </div>

            <div className="row">
              <Field label="Weight today">
                <div className="withunit">
                  <input className="num" inputMode="decimal" value={form.weight} onChange={set("weight")} placeholder="168" />
                  <span className="unit">lb</span>
                </div>
              </Field>
              <Field label="Where you want to be">
                <div className="withunit">
                  <input className="num" inputMode="decimal" value={form.goal} onChange={set("goal")} placeholder="145" />
                  <span className="unit">lb</span>
                </div>
              </Field>
            </div>

            <Field label="Your week, honestly">
              <div className="acts">
                {ACTIVITY.map((a) => (
                  <button
                    key={a.key}
                    className={"act " + (form.activity === a.key ? "on" : "")}
                    onClick={() => setForm({ ...form, activity: a.key })}
                  >
                    <span className="act-l">{a.label}</span>
                    <span className="act-n">{a.note}</span>
                  </button>
                ))}
              </div>
            </Field>

            <button className="cta" onClick={run}>
              Show my timeline
            </button>

            {plan && !plan.ok && <Problem reason={plan.reason} />}
          </section>
        </>
      ) : null}

      {step === "plan" && plan?.ok && (
        <div ref={planRef}>
          <PlanView plan={plan} onReady={() => setStep("pricing")} />
        </div>
      )}

      {step === "pricing" && <Pricing plan={plan} onChoose={choose} onBack={() => setStep("plan")} />}

      {step === "checkout" && (
        <Checkout plan={plan} tier={tier} leadId={leadId} onPaid={paid} onBack={() => setStep("pricing")} />
      )}

      {step === "start" && <WeekOne plan={plan} tier={tier} form={form} />}

      <footer>
        <p>
          Estimates, not promises. Bodies are not spreadsheets — the plan gets adjusted
          from your real data starting week two. If you're pregnant, managing a medical
          condition, or have a history with food and your body that makes numbers hard,
          talk to me before you start rather than filling this out.
        </p>
      </footer>
    </div>
  );
}

/* ---------------------------- pieces ---------------------------- */

function ReverseLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="inline-link" onClick={() => setOpen(!open)} aria-expanded={open}>
        What's a reverse diet? {open ? "−" : "+"}
      </button>
      {open && (
        <span className="explainer">
          <strong>Reverse dieting is the part nobody talks about.</strong> When you eat in
          a deficit for months, your maintenance calories drop — a little from metabolism,
          mostly because you move less without ever noticing you're doing it. So if you hit
          your goal and go back to eating "normally," normal is now way above the
          maintenance you actually have. That's the bounce-back, and it isn't a willpower
          problem.
          <br />
          <br />
          Instead we walk your calories up slowly, roughly 75 more a week, and let your
          body catch up to each step. You finish eating more food than you were eating
          before you ever started, holding the body you worked for. It takes a couple
          months and it's the entire difference between a result and a phase.
        </span>
      )}
    </>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      {children}
    </label>
  );
}

function Problem({ reason }) {
  const copy = {
    incomplete: "Fill in age, height, and both weights and I'll run it.",
    age: "This one's built for adults 16 to 90. Anything outside that, message me directly.",
    "already-there": "You're within a couple pounds of your goal. That's not a cut, that's a maintenance conversation — and a much better one to have on a call.",
    floor: "That goal weight sits below a healthy range for your height, so I'm not going to hand you a plan for it. Nudge the number up, or message me and let's talk about what you're actually chasing — it's usually not the number.",
  };
  return <p className="problem">{copy[reason]}</p>;
}

function PlanView({ plan, onReady }) {
  const start = new Date();
  const end = addWeeks(start, plan.totalWeeks);
  const months = (plan.totalWeeks / 4.345).toFixed(1);

  let acc = 0;
  const withDates = plan.phases.map((p) => {
    const s = addWeeks(start, acc);
    acc += p.weeks;
    return { ...p, start: s, end: addWeeks(start, acc) };
  });

  return (
    <section className="plan">
      <p className="eyebrow center">Your phase plan</p>

      <div className="verdict">
        <span className="v-num">{plan.totalWeeks}</span>
        <span className="v-unit">weeks</span>
        <span className="v-sub">
          about {months} months · done {fmtShort(end)}, {end.getFullYear()}
        </span>
      </div>

      {/* ---- signature: the phase bar ---- */}
      <div className="bar" role="img" aria-label={`Timeline of ${plan.totalWeeks} weeks across ${withDates.length} phases`}>
        {withDates.map((p, i) => (
          <div
            key={p.key}
            className="seg-wrap"
            style={{ flexGrow: p.weeks, animationDelay: `${i * 90}ms` }}
          >
            <div className="seg-bar" style={{ background: KIND_COLOR[p.kind] }} />
            <span className="seg-w">{p.weeks}w</span>
          </div>
        ))}
      </div>

      <div className="ledger">
        {withDates.map((p) => (
          <div className="led-row" key={p.key}>
            <span className="dot" style={{ background: KIND_COLOR[p.kind] }} />
            <span className="led-label">{p.label}</span>
            <span className="led-dates">
              {fmtShort(p.start)} → {fmtShort(p.end)}
            </span>
            <span className="led-weeks">{p.weeks}w</span>
          </div>
        ))}
      </div>

      <div className="stats">
        <Stat k="Maintenance now" v={`${plan.tdee}`} u="cal" />
        <Stat k={plan.losing ? "Deficit calories" : "Surplus calories"} v={`${plan.cutCals}`} u="cal" />
        <Stat k="Rate" v={plan.weeklyLbs.toFixed(2)} u="lb / wk" />
        <Stat k="Maintenance at goal" v={`${plan.goalTdee}`} u="cal" />
      </div>

      {plan.losing && (
        <div className="why">
          <h3>Why it isn't just {plan.dietingWeeks} weeks</h3>
          <p>
            The deficit is {plan.dietingWeeks} weeks. Then there's the reverse — {plan.reverseWeeks} weeks
            of walking calories back up, roughly 75 a week, until you're eating around{" "}
            {plan.goalTdee} again without regaining. Skip it and you finish the hard part
            eating {plan.cutCals} calories with a body primed to store everything. That's
            the part where people gain it back, and it's the part nobody puts on the sales page.
          </p>
          {plan.notes.map((n, i) => (
            <p className="note" key={i}>{n}</p>
          ))}
        </div>
      )}

      <button className="cta big" onClick={onReady}>
        I'm ready — show me the how
      </button>
      <p className="micro">Your timeline is yours. The plan behind it is where I come in.</p>
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

function Pricing({ plan, onChoose, onBack }) {
  const tiers = [
    {
      key: "diy",
      name: "Do it yourself",
      price: PRICES.diy,
      line: "The whole plan, none of me.",
      items: [
        "Your full phase plan with dates",
        "Macro targets set from your baseline week",
        "The weekly adjustment rules I use",
        "Tracking sheet + reverse diet protocol",
        "No calls, no messaging",
      ],
    },
    {
      key: "m1",
      name: "One month",
      price: PRICES.m1,
      line: "Try it before you commit to a phase.",
      items: [
        "Everything in DIY",
        "One 45-minute call",
        "Weekly check-in and adjustment",
        "Message me when you're stuck",
      ],
    },
    {
      key: "m3",
      name: "Three months",
      price: PRICES.m3,
      line: "Long enough to see the plan work.",
      best: true,
      items: [
        "Everything in One month",
        "One call every month",
        "Diet breaks programmed, not improvised",
        "Recalibrated as your maintenance moves",
      ],
    },
    {
      key: "m6",
      name: "Six months",
      price: PRICES.m6,
      line: `Covers the deficit and the reverse.`,
      items: [
        "Everything in Three months",
        "The full reverse diet coached, not handed over",
        "Maintenance plan when you land",
        "Best per-month rate",
      ],
    },
  ];

  return (
    <section className="pricing">
      <button className="back" onClick={onBack}>← back to my timeline</button>
      <p className="eyebrow center">Pick your lane</p>
      <h2 className="ph2">
        {plan?.totalWeeks ? `${plan.totalWeeks} weeks of work. ` : ""}How much of it do you want to do alone?
      </h2>

      <div className="tiers">
        {tiers.map((t) => (
          <div className={"tier " + (t.best ? "best" : "")} key={t.key}>
            {t.best && <span className="flag">Most people</span>}
            <h3>{t.name}</h3>
            <p className="t-line">{t.line}</p>
            <div className="t-price">
              <span className="t-amt">{t.price.amount}</span>
              <span className="t-cad">{t.price.cadence}</span>
            </div>
            <ul>
              {t.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <button className="cta small" onClick={() => onChoose(t.key)}>
              Start {t.name.toLowerCase()}
            </button>
          </div>
        ))}
      </div>
      <p className="micro center">Cancel any time. If the plan isn't right for you in week one, I'll refund it.</p>
    </section>
  );
}

function Checkout({ plan, tier, leadId, onPaid, onBack }) {
  const [c, setC] = useState({ name: "", email: "", agree: false });
  const [err, setErr] = useState("");
  const price = PRICES[tier];
  const start = new Date();
  const end = addWeeks(start, plan?.totalWeeks || 0);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });

  const go = () => {
    if (!c.name.trim()) return setErr("I need a name to put on your plan.");
    if (!/^\S+@\S+\.\S+$/.test(c.email)) return setErr("That email doesn't look right — check it and try again.");
    if (!c.agree) return setErr("Tick the box so we're on the same page about what you're buying.");
    setErr("");
    const link = STRIPE_LINKS[tier];
    if (link) {
      const params = new URLSearchParams({ prefilled_email: c.email });
      if (leadId) params.set("client_reference_id", leadId);
      window.location.href = `${link}?${params.toString()}`;
    } else {
      onPaid();
    }
  };

  return (
    <section className="checkout">
      <button className="back" onClick={onBack}>← back to plans</button>
      <p className="eyebrow center">Create your profile</p>
      <h2 className="ph2">Last screen before we start.</h2>

      <div className="co-grid">
        <div className="card co-form">
          <Field label="Your name">
            <input className="txt" value={c.name} onChange={set("name")} placeholder="First and last" />
          </Field>
          <Field label="Email">
            <input className="txt" type="email" value={c.email} onChange={set("email")} placeholder="you@email.com" />
            <span className="hint">
              This becomes your login — a magic link, no password. Your plan, macros, and
              check-ins all live in your portal, not your inbox.
            </span>
          </Field>

          <label className="agree">
            <input type="checkbox" checked={c.agree} onChange={(e) => setC({ ...c, agree: e.target.checked })} />
            <span>
              I understand this is coaching, not medical care, and that my timeline is an
              estimate that gets adjusted from my real data.
            </span>
          </label>

          <button className="cta" onClick={go}>
            Continue to secure payment
          </button>
          {err && <p className="problem">{err}</p>}
          <p className="micro">
            Card details are handled by Stripe. I never see them.
          </p>
        </div>

        <aside className="co-summary">
          <h3>What you're buying</h3>
          <div className="co-line">
            <span>{TIER_NAMES[tier]}</span>
            <span className="mono">{price.amount}</span>
          </div>
          <p className="co-cad">{price.cadence}</p>

          <div className="co-rule" />

          <div className="co-line sm">
            <span>Your plan</span>
            <span className="mono">{plan?.totalWeeks}w</span>
          </div>
          <div className="co-line sm">
            <span>Starts</span>
            <span className="mono">{fmtShort(start)}</span>
          </div>
          <div className="co-line sm">
            <span>Goal date</span>
            <span className="mono">{fmtShort(end)}</span>
          </div>
          <div className="co-line sm">
            <span>First week</span>
            <span className="mono">Baseline</span>
          </div>

          <div className="co-rule" />
          <p className="co-note">
            You already know your end date. That's the whole point — you're buying a plan
            with a finish line, not a subscription that needs you to stay.
          </p>
        </aside>
      </div>
    </section>
  );
}

function WeekOne({ plan, tier, form }) {
  const [weight, setWeight] = useState("");
  const [cal, setCal] = useState(Array(7).fill(""));
  const [mm, setMm] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("phaseplan:checkin:1");
        const v = JSON.parse(r.value);
        setWeight(v.weight || "");
        setCal(v.cal || Array(7).fill(""));
        setMm(v.mm || "");
      } catch (e) {}
    })();
  }, []);

  const updCal = (i, v) => {
    setCal(cal.map((d, j) => (i === j ? v : d)));
    setSaved(false);
  };

  const save = async () => {
    try {
      await window.storage.set("phaseplan:checkin:1", JSON.stringify({ weight, cal, mm }));
      setSaved(true);
    } catch (e) {
      setSaved("error");
    }
  };

  const nums = cal.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
  const avgC = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  const complete = nums.length >= 5 && weight;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <section className="week1">
      <p className="eyebrow center">Week 1 of {plan?.totalWeeks || "\u2014"}</p>
      <h2 className="ph2">Change nothing. Just watch.</h2>
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

      <div className="checkin">
        <div className="ci-weight">
          <span className="flabel">This week's weigh-in</span>
          <div className="withunit">
            <input
              className="num big-num"
              inputMode="decimal"
              value={weight}
              onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
              placeholder="—"
            />
            <span className="unit">lb</span>
          </div>
        </div>

        <div className="ci-cals">
          <span className="flabel">Calories, day by day</span>
          <div className="cal-grid">
            {days.map((d, i) => (
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

      <button className="cta" onClick={save}>
        {saved === true ? "Saved" : "Save my check-in"}
      </button>
      {saved === "error" && (
        <p className="problem">That didn't save. Screenshot this and text it to me instead.</p>
      )}

      <div className={"unlock " + (complete ? "ready" : "")}>
        <h3>{complete ? "Your targets are ready" : "Your targets unlock when this week is done"}</h3>
        <p>
          {complete
            ? `Your real maintenance is sitting around ${avgC} calories — not the ${plan?.tdee} the calculator guessed. That's the number your deficit gets built from. Your targets will show up right here, usually within a day.`
            : `Fill in at least five days and your weigh-in, and I'll set your protein, fat, and carb targets off your real maintenance instead of an estimate — they'll land right here, not your inbox.`}
        </p>
      </div>

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
            onChange={(e) => { setMm(e.target.value); setSaved(false); }}
            placeholder="your My Macros+ email"
          />
        </div>
        <p className="attrib">Macros Powered by My Macros+</p>
      </div>

      <p className="micro center">
        {tier === "diy"
          ? "You're on the DIY plan — your full protocol is right here in your portal."
          : "Your first call gets set up from here — details show up in your portal, not your inbox."}
      </p>
    </section>
  );
}

/* ---------------------------- styles ---------------------------- */

function Styles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Karla:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.pp {
  --ink:#0E1A22; --tide:#16262F; --panel:#1B2F39; --edge:#274150; --edge-lit:#3E6373;
  --chalk:#EFE7D8; --mute:#8FA6B0; --sage:#8FB08A; --gold:#D9A54C; --rose:#C97F6E;
  --display:'Fraunces', Georgia, serif;
  --body:'Karla', system-ui, sans-serif;
  --mono:'IBM Plex Mono', ui-monospace, monospace;
  background: var(--ink);
  color: var(--chalk);
  font-family: var(--body);
  min-height:100vh;
  padding: 0 20px 80px;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
.pp *{box-sizing:border-box}
.pp button:focus-visible, .pp input:focus-visible { outline:2px solid var(--gold); outline-offset:2px; }

.masthead{max-width:760px;margin:0 auto;padding:26px 0 16px;display:flex;flex-direction:column;gap:5px;border-bottom:1px solid var(--edge)}
.mark{font-family:var(--display);font-size:19px;letter-spacing:.01em}
.mark-note{font-family:var(--mono);font-size:11px;color:var(--gold);letter-spacing:.06em}

.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:0 0 14px}
.eyebrow.center{text-align:center}

.hero{max-width:760px;margin:0 auto;padding:54px 0 34px}
.hero h1{font-family:var(--display);font-weight:600;font-size:clamp(40px,8vw,76px);line-height:.98;margin:0 0 6px;letter-spacing:-.03em}
.hero-sub{font-family:var(--display);font-weight:400;font-size:clamp(21px,3.4vw,30px);line-height:1.2;margin:0 0 26px;color:var(--chalk);letter-spacing:-.01em}
.hero-sub em{font-style:italic;color:var(--gold)}
.lede{font-size:16.5px;color:var(--mute);max-width:60ch;margin:0}
.lede p{margin:0 0 15px}
.lede p:last-child{margin-bottom:0}
.lede em{font-style:italic;color:var(--chalk);font-weight:500}
.lede.center{margin:0 auto 30px;text-align:center}

.inline-link{background:none;border:0;padding:0;font-family:var(--body);font-size:16.5px;color:var(--gold);cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.explainer{display:block;margin-top:16px;padding:16px 18px;background:var(--tide);border-left:2px solid var(--gold);border-radius:2px;font-size:14.5px;line-height:1.6;color:#CBD8DD}
.explainer strong{color:var(--chalk)}

.card{max-width:760px;margin:0 auto;background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:28px}
.row{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px}
.row .field{flex:1 1 180px}
.field{display:block;margin-bottom:20px}
.flabel{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-bottom:9px}

.num{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--mono);font-size:19px;padding:11px 12px;border-radius:3px;width:100%}
.num.sm{width:72px;text-align:center}
.num::placeholder{color:#4E6875}
.withunit,.height{display:flex;align-items:center;gap:8px}
.unit{font-family:var(--mono);font-size:12px;color:var(--mute)}

.seg{display:flex;border:1px solid var(--edge);border-radius:3px;overflow:hidden}
.seg button{flex:1;background:var(--ink);border:0;color:var(--mute);font-family:var(--body);font-size:14px;padding:12px;cursor:pointer}
.seg button.on{background:var(--edge-lit);color:var(--chalk)}

.acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:9px}
.act{text-align:left;background:var(--ink);border:1px solid var(--edge);border-radius:3px;padding:12px;cursor:pointer;color:var(--chalk);font-family:var(--body)}
.act.on{border-color:var(--sage);background:#1A2E2C}
.act-l{display:block;font-size:14px;font-weight:500}
.act-n{display:block;font-size:12px;color:var(--mute);margin-top:2px;line-height:1.35}

.cta{width:100%;background:var(--gold);color:#1A1206;border:0;border-radius:3px;padding:16px;font-family:var(--body);font-weight:700;font-size:15px;letter-spacing:.01em;cursor:pointer;transition:filter .15s}
.cta:hover{filter:brightness(1.08)}
.cta.big{max-width:420px;margin:34px auto 0;display:block}
.cta.small{margin-top:16px;padding:13px;font-size:14px}
.micro{font-family:var(--mono);font-size:11px;color:var(--mute);text-align:center;margin:12px 0 0}
.micro.center{margin-top:26px}
.problem{color:var(--rose);font-size:14px;margin:16px 0 0;line-height:1.5}

/* plan */
.plan{max-width:760px;margin:70px auto 0;padding-top:34px;border-top:1px solid var(--edge)}
.verdict{text-align:center;margin-bottom:40px}
.v-num{font-family:var(--display);font-size:clamp(72px,17vw,132px);font-weight:600;line-height:.9;display:block;letter-spacing:-.03em}
.v-unit{font-family:var(--mono);font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);display:block;margin-top:8px}
.v-sub{display:block;color:var(--mute);font-size:14px;margin-top:12px}

.bar{display:flex;gap:3px;height:56px;margin-bottom:26px}
.seg-wrap{display:flex;flex-direction:column;gap:6px;min-width:12px;transform-origin:left;animation:grow .5s cubic-bezier(.2,.8,.3,1) backwards}
.seg-bar{flex:1;border-radius:2px}
.seg-w{font-family:var(--mono);font-size:10px;color:var(--mute);text-align:center}
@keyframes grow{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.seg-wrap{animation:none}}

.ledger{border-top:1px solid var(--edge);margin-bottom:30px}
.led-row{display:flex;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--edge);font-size:14px}
.dot{width:9px;height:9px;border-radius:50%;flex:none}
.led-label{flex:1}
.led-dates,.led-weeks{font-family:var(--mono);font-size:12px;color:var(--mute)}
.led-weeks{width:38px;text-align:right}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--edge);border:1px solid var(--edge);margin-bottom:34px}
.stat{background:var(--tide);padding:16px}
.s-k{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.s-v{display:block;font-family:var(--display);font-size:30px;font-weight:600;margin-top:6px;line-height:1}
.s-u{font-family:var(--mono);font-size:11px;color:var(--mute)}

.why{background:var(--tide);border-left:2px solid var(--gold);padding:22px 24px}
.why h3{font-family:var(--display);font-size:22px;font-weight:600;margin:0 0 12px}
.why p{margin:0 0 12px;font-size:15px;color:#CBD8DD}
.note{font-family:var(--mono);font-size:12px;color:var(--gold)}

/* pricing */
.pricing{max-width:1000px;margin:70px auto 0}
.back{background:none;border:0;color:var(--mute);font-family:var(--mono);font-size:12px;cursor:pointer;padding:0;margin-bottom:26px}
.ph2{font-family:var(--display);font-weight:600;font-size:clamp(28px,5vw,44px);line-height:1.08;text-align:center;margin:0 auto 40px;max-width:18ch;letter-spacing:-.02em}
.tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(224px,1fr));gap:14px}
.tier{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px;position:relative;display:flex;flex-direction:column}
.tier.best{border-color:var(--gold)}
.flag{position:absolute;top:-9px;left:20px;background:var(--gold);color:#1A1206;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:2px}
.tier h3{font-family:var(--display);font-size:23px;font-weight:600;margin:0 0 4px}
.t-line{color:var(--mute);font-size:13px;margin:0 0 16px;min-height:36px}
.t-price{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--edge)}
.t-amt{font-family:var(--display);font-size:34px;font-weight:600;display:block;line-height:1}
.t-cad{font-family:var(--mono);font-size:11px;color:var(--mute)}
.tier ul{list-style:none;padding:0;margin:0 0 auto;font-size:13.5px}
.tier li{padding-left:16px;position:relative;margin-bottom:8px;color:#CBD8DD;line-height:1.4}
.tier li:before{content:"";position:absolute;left:0;top:8px;width:6px;height:1px;background:var(--sage)}

/* week 1 */
.week1{max-width:700px;margin:50px auto 0}
.rules{counter-reset:r;list-style:none;padding:0;margin:0 0 34px}
.rules li{counter-increment:r;position:relative;padding-left:40px;margin-bottom:18px;font-size:15px;color:#CBD8DD;line-height:1.5}
.rules li:before{content:counter(r,decimal-leading-zero);position:absolute;left:0;top:1px;font-family:var(--mono);font-size:12px;color:var(--gold)}
.rules strong{color:var(--chalk);font-weight:700}

.logger{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:6px 16px 16px;margin-bottom:20px}
.log-head,.log-foot,.log-row{display:grid;grid-template-columns:52px 1fr 1fr;gap:10px;align-items:center}
.log-head{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);padding:12px 0 8px;border-bottom:1px solid var(--edge)}
.log-row{padding:6px 0}
.log-day{font-family:var(--mono);font-size:13px;color:var(--mute)}
.log-row .num.sm{width:100%}
.log-foot{border-top:1px solid var(--edge);margin-top:8px;padding-top:12px;font-family:var(--mono);font-size:12px;color:var(--gold)}
.mono{font-family:var(--mono)}

.unlock{margin-top:30px;border:1px dashed var(--edge-lit);border-radius:4px;padding:20px}
.unlock.ready{border-style:solid;border-color:var(--sage);background:#182C2A}
.unlock h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.unlock p{margin:0;font-size:14px;color:#CBD8DD}

footer{max-width:700px;margin:70px auto 0;padding-top:22px;border-top:1px solid var(--edge)}
footer p{font-size:12px;color:var(--mute);line-height:1.6;margin:0}

/* checkout */
.checkout{max-width:900px;margin:60px auto 0}
.co-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:18px;align-items:start}
.co-form{margin:0}
.txt{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:15px;padding:12px;border-radius:3px;width:100%}
.txt::placeholder{color:#4E6875}
.hint{display:block;font-size:12px;color:var(--mute);margin-top:6px;line-height:1.45}
.agree{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--mute);margin:6px 0 20px;line-height:1.45;cursor:pointer}
.agree input{margin-top:3px;accent-color:var(--gold);flex:none}
.co-summary{background:var(--tide);border:1px solid var(--gold);border-radius:4px;padding:22px}
.co-summary h3{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin:0 0 14px;font-weight:400}
.co-line{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-family:var(--display);font-size:20px;font-weight:600}
.co-line.sm{font-family:var(--body);font-size:13.5px;font-weight:400;color:#CBD8DD;margin-bottom:7px}
.co-line.sm .mono{color:var(--chalk)}
.co-cad{font-family:var(--mono);font-size:11px;color:var(--gold);margin:4px 0 0}
.co-rule{height:1px;background:var(--edge);margin:18px 0}
.co-note{font-size:13px;color:var(--mute);margin:0;line-height:1.5}

/* weigh-in protocol */
.protocol{background:var(--tide);border-left:2px solid var(--sage);border-radius:2px;padding:20px 22px;margin-bottom:26px}
.protocol h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.protocol p{margin:0 0 10px;font-size:14.5px;color:#CBD8DD}
.protocol ul{margin:0 0 12px;padding-left:0;list-style:none}
.protocol li{position:relative;padding-left:18px;margin-bottom:6px;font-size:14.5px;color:var(--chalk)}
.protocol li:before{content:"";position:absolute;left:0;top:10px;width:8px;height:1px;background:var(--sage)}
.p-note{font-size:13px !important;color:var(--mute) !important;margin-bottom:0 !important}

/* weekly check-in */
.checkin{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px;margin-bottom:20px}
.ci-weight{padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid var(--edge)}
.big-num{font-size:30px !important;max-width:170px;text-align:center}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.cal-cell{display:flex;flex-direction:column;gap:5px;text-align:center}
.cal-cell span{font-family:var(--mono);font-size:10px;color:var(--mute)}
.cal-cell .num.sm{width:100%;font-size:14px;padding:9px 2px}
.ci-avg{font-family:var(--mono);font-size:12px;color:var(--mute);margin:14px 0 0;text-align:right}
.ci-avg .mono{color:var(--gold);font-size:15px;margin-left:6px}

/* my macros+ */
.mmplus{margin-top:22px;background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px}
.mmplus h3{font-family:var(--display);font-size:20px;font-weight:600;margin:0 0 8px}
.mmplus p{font-size:14px;color:#CBD8DD;margin:0 0 14px;line-height:1.5}
.mm-steps{counter-reset:m;list-style:none;padding:0;margin:0 0 16px}
.mm-steps li{counter-increment:m;position:relative;padding-left:26px;margin-bottom:7px;font-size:14px;color:var(--chalk)}
.mm-steps li:before{content:counter(m);position:absolute;left:0;top:0;font-family:var(--mono);font-size:11px;color:var(--gold)}
.attrib{font-family:var(--mono) !important;font-size:10px !important;color:var(--mute) !important;letter-spacing:.08em;margin:14px 0 0 !important;text-align:right}

@media (max-width:720px){
  .co-grid{grid-template-columns:1fr}
  .cal-grid{grid-template-columns:repeat(4,1fr)}
}

@media (max-width:560px){
  .hero{padding:36px 0 26px}
  .card{padding:20px}
  .row{gap:12px}
}
    `}</style>
  );
}
