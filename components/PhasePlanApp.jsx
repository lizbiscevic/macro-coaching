"use client";

import { useState, useEffect, useRef } from "react";
import { computePlan, ACTIVITY, KIND_COLOR, addWeeks, fmtShort } from "@/lib/plan";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/* ------------------------------------------------------------------
   PHASE PLAN — ported from the PhasePlan.jsx prototype (see
   /reference). Free timeline calculator -> pricing -> create a
   profile & pay, all in one client component so the flow-state logic
   stays exactly as it was in the source of truth. Once paid, this
   hands off to Supabase magic-link auth and /portal (ClientPortal),
   which owns everything after that — check-ins, messaging, booking —
   so it isn't maintained in two places.
-------------------------------------------------------------------*/

const COACH = {
  name: "Macro Coaching With Liz",
  tagline: "No BS. No guesswork. Real timelines and results that stick.",
};

const PRICES = {
  diy: { amount: "$89", cadence: "one time" },
  m1: { amount: "$249", cadence: "per month · cancel any time" },
  m3: { amount: "$199/mo", cadence: "billed one time at $597 · 3 months" },
  m6: { amount: "$169/mo", cadence: "billed one time at $1,014 · 6 months" },
};

const TIER_NAMES = {
  diy: "Do it yourself",
  m1: "One month",
  m3: "Three months",
  m6: "Six months",
};

/* ---------------------------- app ---------------------------- */

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PhasePlanApp() {
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
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState(todayISO);
  const planRef = useRef(null);

  // Persisted at every step, not just after payment — so someone who computes
  // a timeline, picks a tier, or bails mid-checkout doesn't lose it on reload.
  // leadId is the anchor: it's generated the moment they have a real plan and
  // gets passed to Stripe as client_reference_id so the webhook can match the
  // payment back to this record without relying on the email staying identical.
  // Written to localStorage for instant same-browser reloads AND to a Supabase
  // row (best-effort, fire-and-forget — /api/lead degrades to a no-op until
  // Supabase is configured) so it survives a lost tab/device per the brief's
  // "persist before payment" note. `paid` itself is never trusted from here —
  // only the server ever sets that flag to true, via checkout-status or the
  // Stripe webhook.
  const save = (data) => {
    try {
      window.localStorage.setItem("phaseplan:client", JSON.stringify(data));
    } catch (e) {}
    if (data.leadId) {
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: data.leadId,
          form: data.form,
          startDate: data.startDate,
          tier: data.tier,
        }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    // Hydrating from localStorage (an external system) on mount, per
    // https://react.dev/learn/synchronizing-with-effects — can't read it
    // during render since it isn't available during SSR.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = window.localStorage.getItem("phaseplan:client");
      if (raw) {
        const v = JSON.parse(raw);
        if (v.form) setForm(v.form);
        if (v.leadId) setLeadId(v.leadId);
        if (v.startDate) setStartDate(v.startDate);
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
      }
    } catch (e) {
      /* first visit */
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // Stripe's Payment Link redirects back here with ?session_id=... on the
    // configured success URL. Never trust that redirect by itself — confirm
    // with our own server route, which asks Stripe directly whether the
    // session actually paid before it touches Supabase or app state.
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) return;

    fetch(`/api/checkout-status?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then(({ paid: isPaid, leadId: confirmedId }) => {
        window.history.replaceState({}, "", window.location.pathname);
        if (!isPaid || !confirmedId) return null;
        // Pull the full record back — on a different device/browser than
        // the one that ran the calculator, localStorage above found nothing.
        return fetch(`/api/lead?id=${encodeURIComponent(confirmedId)}`).then((r) => r.json());
      })
      .then((res) => {
        const lead = res?.lead;
        if (!lead) return;
        setLeadId(lead.id);
        if (lead.form) setPlan(computePlan(lead.form));
        if (lead.form) setForm(lead.form);
        if (lead.tier) setTier(lead.tier);
        if (lead.start_date) setStartDate(lead.start_date);
        if (lead.email) setEmail(lead.email);
        setStep("start");
        try {
          window.localStorage.setItem(
            "phaseplan:client",
            JSON.stringify({ leadId: lead.id, form: lead.form, startDate: lead.start_date, tier: lead.tier, paid: true })
          );
        } catch (e) {}
      })
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = () => {
    const p = computePlan(form);
    setPlan(p);
    if (p.ok) {
      const id = leadId || (crypto.randomUUID ? crypto.randomUUID() : `lead_${Date.now()}`);
      setLeadId(id);
      setStep("plan");
      save({ leadId: id, form, startDate, tier: null, paid: false });
      setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }
  };

  const ready = () => {
    setStep("pricing");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  const choose = (t) => {
    setTier(t);
    setStep("checkout");
    save({ leadId, form, startDate, tier: t, paid: false });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60);
  };

  const goHome = () => {
    setStep("calc");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pp">
      <Styles />

      <header className="masthead">
        <button className="mark-link" onClick={goHome}>
          <span className="mark">{COACH.name}</span>
          <span className="mark-note">{COACH.tagline}</span>
        </button>
      </header>

      {step === "calc" || step === "plan" ? (
        <>
          <Hero />

          <section className="whyme">
            <p className="eyebrow center">Why work with me</p>
            <div className="lede center">
              <p>
                Let's be real — it's about food, but it's also about life. Diet culture
                is a cycle of punishment: restrict, feel guilty, start over Monday. This
                macro journey is about empowerment — empowering you to live your life,
                eat what you actually want, and still hit your goal. Having your cake
                and eating it too, <em>literally</em>.
              </p>
              <p>
                People who've worked with me say it feels less like hiring a coach and
                more like having a sister or a best friend in your corner. We'll get to
                know each other. We'll talk. We'll hit your goals.
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
          <PlanView
            plan={plan}
            startDate={startDate}
            onStartDateChange={(d) => {
              setStartDate(d);
              save({ leadId, form, startDate: d, tier: null, paid: false });
            }}
            onReady={ready}
          />
        </div>
      )}

      {step === "pricing" && <Pricing plan={plan} onChoose={choose} onBack={() => setStep("plan")} />}

      {step === "checkout" && (
        <Checkout
          plan={plan}
          tier={tier}
          leadId={leadId}
          startDate={startDate}
          onBack={() => setStep("pricing")}
        />
      )}

      {step === "start" && <PostPaymentGate email={email} />}

      <footer>
        <p>
          Estimates, not promises. Bodies are not spreadsheets — the plan gets adjusted
          from your real data starting week two. If you're pregnant, managing a medical
          condition, or have a history with food and your body that makes numbers hard,
          talk to a doctor before starting any new program.
        </p>
      </footer>
    </div>
  );
}

/* ---------------------------- pieces ---------------------------- */

function Hero() {
  const [open, setOpen] = useState(false);
  return (
    <section className="hero">
      <h1>Start here.</h1>
      <p className="hero-sub">
        Let's talk about <em>realistic</em> goals.
      </p>
      <div className={"lede " + (open ? "open" : "")}>
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
      <button className="hero-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Show less −" : "Read more +"}
      </button>
    </section>
  );
}

function ReverseLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <br />
      <button className="inline-link" onClick={() => setOpen(!open)} aria-expanded={open}>
        READ MORE: What's a reverse diet? {open ? "−" : "+"}
      </button>
      {open && (
        <span className="explainer">
          <strong>
            A reverse diet is what we do after you hit your goal weight so your body doesn't
            immediately try to pull you back to where you started.
          </strong>{" "}
          Your body likes homeostasis — it likes what it knows. So after months of dieting
          in a deficit and losing weight, you don't want to just stop tracking and go
          straight back to eating the way you did before. Your body is still adjusting to
          this new weight, and if you suddenly increase food, it's very easy to rebound.
          <br />
          <br />
          Instead, we slowly bring your calories back up while keeping you around your new
          weight. The goal is to basically teach your body — and train your metabolism —
          that this is the new normal. You spend time maintaining here so that eventually,
          when you stop tracking macros so closely, your body isn't fighting to get back to
          where it was before. Reverse dieting is the part that helps turn weight loss from
          a temporary phase into something you can actually maintain. It is always baked in
          to your plan when working with me.
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

function PlanView({ plan, startDate, onStartDateChange, onReady }) {
  const start = new Date(startDate + "T00:00:00");
  const end = addWeeks(start, plan.totalWeeks);
  const months = (plan.totalWeeks / 4.345).toFixed(1);

  const withDates = plan.phases.reduce((rows, p) => {
    const priorWeeks = rows.length ? rows[rows.length - 1].weeksAcc : 0;
    const weeksAcc = priorWeeks + p.weeks;
    rows.push({ ...p, start: addWeeks(start, priorWeeks), end: addWeeks(start, weeksAcc), weeksAcc });
    return rows;
  }, []);

  return (
    <section className="plan">
      <p className="eyebrow center">Your phase plan</p>

      <div className="startpick">
        <label className="flabel">Start date</label>
        <input
          type="date"
          className="date"
          value={startDate}
          onChange={(e) => e.target.value && onStartDateChange(e.target.value)}
        />
      </div>

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

      {plan.losing && (
        <div className="why">
          <h3>Why it isn't just {plan.dietingWeeks} weeks</h3>
          <p>
            The deficit is {plan.dietingWeeks} weeks. Then there's the reverse — {plan.reverseWeeks} weeks
            of walking calories back up, roughly 75 a week, until you're back to eating like a
            normal person again without regaining. Skip it and you finish the hard part deep
            in a deficit with a body primed to store everything. That's the part where people
            gain it back, and it's the part nobody puts on the sales page.
          </p>
        </div>
      )}

      <button className="cta big" onClick={onReady}>
        I'm ready — show me the how
      </button>
      <p className="micro">Let's start your macro journey!</p>
    </section>
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
      ],
    },
    {
      key: "m1",
      name: "One month",
      price: PRICES.m1,
      line: "Try it before you commit to a phase.",
      items: [
        "A tailored plan customized for you",
        "One 30-minute call",
        "Weekly check-ins and adjustments",
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
        "A tailored plan customized for you",
        "One call every month",
        "Diet breaks built in on longer cuts, not improvised",
        "Recalibrated as your maintenance moves",
      ],
    },
    {
      key: "m6",
      name: "Six months",
      price: PRICES.m6,
      line: `Covers the deficit and the reverse.`,
      items: [
        "A tailored plan customized for you",
        "One call every month",
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
        {plan?.totalWeeks ? `${plan.totalWeeks} weeks of work. ` : ""}Let me teach you how.
      </h2>

      <div className="tiers">
        {tiers.map((t) => (
          <div className={"tier " + (t.best ? "best" : "")} key={t.key}>
            {t.best && <span className="flag">★ Most popular</span>}
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
      <p className="micro center">
        3 and 6 month plans are a one-time purchase. 1 month is a real subscription — cancel any
        time. Not right for you in week one? I'll refund it.
      </p>
    </section>
  );
}

function Checkout({ plan, tier, leadId, startDate, onBack }) {
  const [c, setC] = useState({ name: "", email: "", agree: false });
  const [err, setErr] = useState("");
  const [going, setGoing] = useState(false);
  const price = PRICES[tier];
  const start = new Date(startDate + "T00:00:00");
  const end = addWeeks(start, plan?.totalWeeks || 0);
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });

  const go = async () => {
    if (!c.name.trim()) return setErr("I need a name to put on your plan.");
    if (!/^\S+@\S+\.\S+$/.test(c.email)) return setErr("That email doesn't look right — check it and try again.");
    if (!c.agree) return setErr("Tick the box so we're on the same page about what you're buying.");
    setErr("");
    setGoing(true);

    // This is the only moment we have name/email before handing off to
    // Stripe's hosted page — save it now so the record has it even though
    // the webhook only ever gives us email back, never a name.
    if (leadId) {
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, name: c.name, email: c.email, tier }),
      }).catch(() => {});
    }

    // Payment is mandatory — a failure here always stops and shows an error,
    // never lets someone through unpaid. There is no demo-mode fallback.
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, email: c.email, leadId }),
      });
      const data = await res.json();
      if (data.url) {
        // Full navigation to Stripe's hosted checkout, not an internal route —
        // router.push()/redirect() don't apply to an off-site destination.
        window.location.href = data.url;
        return;
      }
      setErr("Checkout isn't available right now — message me directly and I'll get you sorted.");
    } catch (e) {
      setErr("That didn't go through — check your connection and try again.");
    }
    setGoing(false);
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

          <button className="cta" onClick={go} disabled={going}>
            {going ? "One sec…" : "Continue to secure payment"}
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
        </aside>
      </div>
    </section>
  );
}

function PostPaymentGate({ email }) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error | unconfigured
  const sentRef = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- fires once (sentRef)
       to kick off signInWithOtp, an external system call, not a render sync */
    if (sentRef.current) return;
    sentRef.current = true;
    if (!supabaseBrowser) {
      setStatus("unconfigured");
      return;
    }
    if (!email) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    supabaseBrowser.auth
      .signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      .then(({ error }) => setStatus(error ? "error" : "sent"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [email]);

  return (
    <section className="gate">
      <p className="eyebrow center">You're in</p>
      <h2 className="ph2">
        {status === "sending" && "Sending your link…"}
        {status === "sent" && `Check your email — I sent a link to ${email}.`}
        {status === "unconfigured" && "Almost there."}
        {status === "error" && "That didn't go through."}
      </h2>
      <p className="lede center">
        {status === "sent" &&
          "Click it to open your portal — that's where your check-ins, macros, and messages live from here on, not your inbox."}
        {status === "unconfigured" &&
          "Login isn't wired up yet on this build — once it is, this is where you'd get a magic link into your portal."}
        {status === "error" && "Message Liz directly and she'll get you sorted."}
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
  --ink:#FAF7FA; --tide:#FFFFFF; --panel:#FFFFFF; --edge:#E5DEE3; --edge-lit:#0B7A78;
  --chalk:#241E28; --mute:#6E6875; --sage:#3AD1C2; --gold:#6E3862; --rose:#B3413A;
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
.pp button:focus-visible, .pp input:focus-visible { outline:2px solid var(--sage); outline-offset:2px; }

.masthead{max-width:760px;margin:0 auto;padding:26px 0 16px;display:flex;border-bottom:1px solid var(--edge)}
.mark-link{background:none;border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:5px;text-align:left;cursor:pointer;color:inherit;font-family:inherit}
.mark{font-family:var(--display);font-size:19px;letter-spacing:.01em}
.mark-note{font-family:var(--mono);font-size:11px;color:var(--sage);letter-spacing:.06em}

.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sage);margin:0 0 14px}
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
.hero-toggle{display:none}

.whyme{max-width:760px;margin:10px auto 0;padding-top:38px;border-top:1px solid var(--edge)}

.inline-link{background:none;border:0;padding:0;font-family:var(--body);font-size:16.5px;color:var(--sage);cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.explainer{display:block;margin-top:16px;padding:16px 18px;background:var(--tide);border-left:2px solid var(--sage);border-radius:2px;font-size:14.5px;line-height:1.6;color:#4A4550}
.explainer strong{color:var(--chalk)}

.card{max-width:760px;margin:0 auto;background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:28px}
.row{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px}
.row .field{flex:1 1 180px}
.field{display:block;margin-bottom:20px}
.flabel{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-bottom:9px}

.num{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--mono);font-size:19px;padding:11px 12px;border-radius:3px;width:100%}
.num.sm{width:72px;text-align:center}
.num::placeholder{color:#A8A0AC}
.withunit,.height{display:flex;align-items:center;gap:8px}
.unit{font-family:var(--mono);font-size:12px;color:var(--mute)}

.seg{display:flex;border:1px solid var(--edge);border-radius:3px;overflow:hidden}
.seg button{flex:1;background:var(--ink);border:0;color:var(--mute);font-family:var(--body);font-size:14px;padding:12px;cursor:pointer}
.seg button.on{background:var(--edge-lit);color:var(--chalk)}

.acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:9px}
.act{text-align:left;background:var(--ink);border:1px solid var(--edge);border-radius:3px;padding:12px;cursor:pointer;color:var(--chalk);font-family:var(--body)}
.act.on{border-color:var(--sage);background:#E3FBF7}
.act-l{display:block;font-size:14px;font-weight:500}
.act-n{display:block;font-size:12px;color:var(--mute);margin-top:2px;line-height:1.35}

.cta{width:100%;background:var(--gold);color:#FFFFFF;border:0;border-radius:3px;padding:16px;font-family:var(--body);font-weight:700;font-size:15px;letter-spacing:.01em;cursor:pointer;transition:filter .15s}
.cta:hover{filter:brightness(1.08)}
.cta.big{max-width:420px;margin:34px auto 0;display:block}
.cta.small{margin-top:16px;padding:13px;font-size:14px}
.micro{font-family:var(--mono);font-size:11px;color:var(--mute);text-align:center;margin:12px 0 0}
.micro.center{margin-top:26px}
.problem{color:var(--rose);font-size:14px;margin:16px 0 0;line-height:1.5}

/* plan */
.plan{max-width:760px;margin:70px auto 0;padding-top:34px;border-top:1px solid var(--edge)}
.startpick{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:26px}
.startpick .flabel{margin:0}
.startpick .date{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--mono);font-size:13px;padding:8px 10px;border-radius:3px;color-scheme:light}
.verdict{text-align:center;margin-bottom:40px}
.v-num{font-family:var(--display);font-size:clamp(72px,17vw,132px);font-weight:600;line-height:.9;display:block;letter-spacing:-.03em}
.v-unit{font-family:var(--mono);font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--sage);display:block;margin-top:8px}
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

.why{background:var(--tide);border-left:2px solid var(--sage);padding:22px 24px}
.why h3{font-family:var(--display);font-size:22px;font-weight:600;margin:0 0 12px}
.why p{margin:0 0 12px;font-size:15px;color:#4A4550}

/* pricing */
.pricing{max-width:1000px;margin:70px auto 0}
.back{background:none;border:0;color:var(--mute);font-family:var(--mono);font-size:12px;cursor:pointer;padding:0;margin-bottom:26px}
.ph2{font-family:var(--display);font-weight:600;font-size:clamp(28px,5vw,44px);line-height:1.08;text-align:center;margin:0 auto 40px;max-width:18ch;letter-spacing:-.02em}
.tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(224px,1fr));gap:14px}
.tier{background:var(--tide);border:1px solid var(--edge);border-radius:4px;padding:22px;position:relative;display:flex;flex-direction:column}
.tier.best{border-color:var(--gold)}
.flag{position:absolute;top:-9px;left:20px;background:var(--gold);color:#FFFFFF;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:2px}
.tier h3{font-family:var(--display);font-size:23px;font-weight:600;margin:0 0 4px}
.t-line{color:var(--mute);font-size:13px;margin:0 0 16px;min-height:36px}
.t-price{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--edge)}
.t-amt{font-family:var(--display);font-size:34px;font-weight:600;display:block;line-height:1}
.t-cad{font-family:var(--mono);font-size:11px;color:var(--mute)}
.tier ul{list-style:none;padding:0;margin:0 0 auto;font-size:13.5px}
.tier li{padding-left:16px;position:relative;margin-bottom:8px;color:#4A4550;line-height:1.4}
.tier li:before{content:"";position:absolute;left:0;top:8px;width:6px;height:1px;background:var(--sage)}

/* post-payment gate */
.gate{max-width:600px;margin:70px auto 0;text-align:center}
.mono{font-family:var(--mono)}

footer{max-width:700px;margin:70px auto 0;padding-top:22px;border-top:1px solid var(--edge)}
footer p{font-size:12px;color:var(--mute);line-height:1.6;margin:0}

/* checkout */
.checkout{max-width:900px;margin:60px auto 0}
.co-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:18px;align-items:start}
.co-form{margin:0}
.txt{background:var(--ink);border:1px solid var(--edge);color:var(--chalk);font-family:var(--body);font-size:15px;padding:12px;border-radius:3px;width:100%}
.txt::placeholder{color:#A8A0AC}
.hint{display:block;font-size:12px;color:var(--mute);margin-top:6px;line-height:1.45}
.agree{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--mute);margin:6px 0 20px;line-height:1.45;cursor:pointer}
.agree input{margin-top:3px;accent-color:var(--gold);flex:none}
.co-summary{background:var(--tide);border:1px solid var(--gold);border-radius:4px;padding:22px}
.co-summary h3{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin:0 0 14px;font-weight:400}
.co-line{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-family:var(--display);font-size:20px;font-weight:600}
.co-line.sm{font-family:var(--body);font-size:13.5px;font-weight:400;color:#4A4550;margin-bottom:7px}
.co-line.sm .mono{color:var(--chalk)}
.co-cad{font-family:var(--mono);font-size:11px;color:var(--sage);margin:4px 0 0}
.co-rule{height:1px;background:var(--edge);margin:18px 0}

@media (max-width:720px){
  .co-grid{grid-template-columns:1fr}
}

@media (max-width:560px){
  .hero{padding:36px 0 26px}
  .card{padding:20px}
  .row{gap:12px}
  .hero .lede{max-height:80px;overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(to bottom,#000 50%,transparent 100%);mask-image:linear-gradient(to bottom,#000 50%,transparent 100%)}
  .hero .lede.open{max-height:none;-webkit-mask-image:none;mask-image:none}
  .hero-toggle{display:block;background:none;border:0;padding:0;margin-top:14px;font-family:var(--body);font-size:14px;font-weight:600;color:var(--sage);cursor:pointer}
}
    `}</style>
  );
}
