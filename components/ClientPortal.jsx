"use client";

import { useState } from "react";
import { computePlan, currentWeekNumber } from "@/lib/plan";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import MessageThread from "@/components/MessageThread";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------
   Authenticated successor to the old WeekOne component. Week 1 keeps
   the original "baseline — change nothing" framing; week 2+ is a
   lighter recurring weekly check-in. Persists to Supabase via
   /api/checkins instead of localStorage, and adds messaging + a
   booking embed (m1/m3/m6 tiers only — DIY has no calls).
-------------------------------------------------------------------*/

export default function ClientPortal({ lead, checkins, initialMessages, bookingUrl }) {
  const plan = computePlan(lead.form || {});
  const totalWeeks = plan.ok ? plan.totalWeeks : null;
  const currentWeek = totalWeeks ? currentWeekNumber(lead.start_date, totalWeeks) : 1;
  const existing = checkins.find((c) => c.week_number === currentWeek);

  const signOut = async () => {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    // Hard navigation, not router.push — this clears client state and lets
    // the server see the now-signed-out cookie fresh on the next request.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  return (
    <div className="portal">
      <Styles />
      <header className="p-head">
        <span className="mark">Macro Coaching With Liz</span>
        <button className="signout" onClick={signOut}>
          Sign out
        </button>
      </header>

      <CheckIn lead={lead} plan={plan} currentWeek={currentWeek} totalWeeks={totalWeeks} existing={existing} />

      {lead.tier && lead.tier !== "diy" && bookingUrl && (
        <section className="booking">
          <p className="eyebrow center">Your monthly call</p>
          <h2 className="ph2">Book time with me.</h2>
          <div className="booking-frame">
            <iframe src={bookingUrl} title="Book a call" loading="lazy" />
          </div>
        </section>
      )}

      <section className="messages">
        <p className="eyebrow center">Message me</p>
        <MessageThread leadId={lead.id} role="client" initialMessages={initialMessages} />
      </section>
    </div>
  );
}

function CheckIn({ lead, plan, currentWeek, totalWeeks, existing }) {
  const [weight, setWeight] = useState(existing?.weigh_in != null ? String(existing.weigh_in) : "");
  const [cal, setCal] = useState(
    existing?.calories ? existing.calories.map((c) => (c == null ? "" : String(c))) : Array(7).fill("")
  );
  const [mm, setMm] = useState(existing?.mymacros_email || "");
  const [saved, setSaved] = useState(false);

  const updCal = (i, v) => {
    setCal(cal.map((d, j) => (i === j ? v : d)));
    setSaved(false);
  };

  const save = async () => {
    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: currentWeek,
          weighIn: weight ? parseFloat(weight) : null,
          calories: cal.map((c) => (c === "" ? null : parseFloat(c))),
          mymacrosEmail: mm || null,
        }),
      });
      setSaved(res.ok ? true : "error");
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
      <h2 className="ph2">{isBaseline ? "Change nothing. Just watch." : "Your weekly check-in."}</h2>

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
      </div>

      <button className="cta" onClick={save}>
        {saved === true ? "Saved" : "Save my check-in"}
      </button>
      {saved === "error" && (
        <p className="problem">That didn't save. Screenshot this and text it to me instead.</p>
      )}

      {isBaseline && (
        <div className={"unlock " + (complete ? "ready" : "")}>
          <h3>{complete ? "Your targets are ready" : "Your targets unlock when this week is done"}</h3>
          <p>
            {complete
              ? `Your real maintenance is sitting around ${avgC} calories — not the ${plan?.tdee} the calculator guessed. That's the number your deficit gets built from. Your targets will show up right here, usually within a day.`
              : `Fill in at least five days and your weigh-in, and I'll set your protein, fat, and carb targets off your real maintenance instead of an estimate — they'll land right here, not your inbox.`}
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

      <p className="micro center">
        {lead.tier === "diy"
          ? "You're on the DIY plan — your full protocol is right here in your portal."
          : "Your calls get booked from here — details show up in your portal, not your inbox."}
      </p>
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

.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sage);margin:0 0 14px}
.eyebrow.center{text-align:center}
.ph2{font-family:var(--display);font-weight:600;font-size:clamp(26px,4.5vw,38px);line-height:1.1;text-align:center;margin:0 auto 20px;max-width:20ch;letter-spacing:-.02em}
.lede.center{color:var(--mute);max-width:56ch;margin:0 auto 30px;text-align:center;font-size:15.5px}

.week1{max-width:700px;margin:50px auto 0}
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
.problem{color:var(--rose);font-size:14px;margin:16px 0 0}
.micro{font-family:var(--mono);font-size:11px;color:var(--mute);text-align:center;margin:12px 0 0}
.micro.center{margin-top:26px}

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

.booking{max-width:700px;margin:60px auto 0}
.booking-frame{border:1px solid var(--edge);border-radius:4px;overflow:hidden;background:var(--tide)}
.booking-frame iframe{width:100%;height:680px;border:0;display:block}

.messages{max-width:700px;margin:60px auto 0}

@media (max-width:560px){
  .cal-grid{grid-template-columns:repeat(4,1fr)}
  .booking-frame iframe{height:560px}
}
    `}</style>
  );
}
