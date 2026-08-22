/* ------------------------------------------------------------------
   Phase plan math — ported from PhasePlan.jsx, unchanged.
   Kept free of React so it can be reused from server code later
   (coach dashboard, macro pushes) as well as the client calculator.
-------------------------------------------------------------------*/

export const ACTIVITY = [
  { key: "sed", label: "Mostly seated", note: "Desk job, little formal exercise", mult: 1.2 },
  { key: "light", label: "Lightly active", note: "Walking daily, training 1–3x", mult: 1.375 },
  { key: "mod", label: "Active", note: "Training 3–5x, on your feet a lot", mult: 1.55 },
  { key: "high", label: "Very active", note: "Training 6x+, physical job", mult: 1.725 },
];

export const KIND_COLOR = {
  baseline: "var(--mute)",
  cut: "var(--sage)",
  gain: "var(--sage)",
  break: "var(--edge-lit)",
  reverse: "var(--gold)",
  hold: "var(--gold)",
};

export function computePlan(f, { realTdee, simpleDietBreaks } = {}) {
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
  // realTdee: baseline-week actual average intake, when known — replaces
  // the BMR*activity guess with the client's real maintenance. Only the
  // "now" side can use real data; goal-side maintenance below still has
  // to be estimated, since they haven't lived at that weight yet.
  const tdee = realTdee || bmr * mult;

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
    let breakWeeks = 0;

    if (simpleDietBreaks) {
      // DIY-plan-only rule: no breaks at all unless the deficit runs past
      // ~3 months, in which case a single 2-week break splits it in two.
      const threshold = 13;
      if (cutWeeks > threshold) {
        phases.push({ key: "cut0", label: "Deficit block 1", weeks: threshold, kind: "cut" });
        phases.push({ key: "brk0", label: "Diet break", weeks: 2, kind: "break" });
        phases.push({ key: "cut1", label: "Deficit block 2", weeks: cutWeeks - threshold, kind: "cut" });
        breakWeeks = 2;
      } else {
        phases.push({ key: "cut0", label: "Deficit", weeks: cutWeeks, kind: "cut" });
      }
    } else {
      // straight through unless there's real distance to cover — one maintenance
      // week per 8 weeks of dieting, only once the cut is more than 20 lb
      const breaks = totalLbs > 20 ? Math.floor(cutWeeks / 8) : 0;
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
      breakWeeks = breaks;
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
      dietingWeeks: cutWeeks + breakWeeks,
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

export const addWeeks = (d, w) => {
  const n = new Date(d);
  n.setDate(n.getDate() + w * 7);
  return n;
};
export const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function currentWeekNumber(startDate, totalWeeks, today = new Date()) {
  const start = new Date(startDate + "T00:00:00");
  const elapsed = Math.floor((today - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(elapsed + 1, 1), totalWeeks || 1);
}

// The "5 of 7 days + a weigh-in" gate — shared between the client portal
// (unlocking Step 2/3) and the checkins API route (the DIY auto-message).
export function isCheckinComplete(checkin) {
  if (!checkin) return false;
  const calCount = (checkin.calories || []).filter((n) => typeof n === "number" && !Number.isNaN(n)).length;
  return checkin.weigh_in != null && calCount >= 5;
}

export function avgCalories(checkin) {
  if (!checkin?.calories) return null;
  const nums = checkin.calories.filter((n) => typeof n === "number" && !Number.isNaN(n));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

// Protein/fat/carb split for a block of the plan, per the coaching
// rulebook. Two inputs the rulebook branches on aren't collected on the
// intake form yet (body-fat category, training experience/vegan status),
// so this always takes the "default" branch of those rules — goal-weight
// protein rather than lean-mass, standard g/lb rather than the lean+hard-
// training bump. Protein is set first and held constant across a client's
// blocks (goal weight doesn't change block to block); fat and carbs are
// re-solved per block since they depend on that block's calorie target.
export function computeMacros(f, calories) {
  const goalLb = +f.goal;
  const weightLb = +f.weight;
  const age = +f.age;
  const female = f.sex !== "male";

  // Protein: 0.8-1.0 g/lb of goal weight (midpoint 0.9), +0.1-0.2 g/lb at
  // 50+ (midpoint 0.15), capped at the ~1.2 g/lb ceiling.
  let proteinPerLb = 0.9;
  if (age >= 50) proteinPerLb += 0.15;
  proteinPerLb = Math.min(proteinPerLb, 1.2);
  const proteinG = Math.round((goalLb * proteinPerLb) / 5) * 5;

  // Fat: base % range by sex/age (women, and everyone 45+, run 28-35%;
  // men under 45 run 20-30%), nudged within that range by activity —
  // more training days pull toward the low end, low activity toward the
  // high end.
  const [loPct, hiPct] = female || age >= 45 ? [28, 35] : [20, 30];
  const activityBias = { sed: 1, light: 0.66, mod: 0.33, high: 0 }[f.activity] ?? 0.5;
  const fatPct = loPct + (hiPct - loPct) * activityBias;
  const fatFloor = Math.max(Math.round((weightLb * 0.3) / 5) * 5, female ? 40 : 50);
  let fatG = Math.max(Math.round((calories * (fatPct / 100) / 9) / 5) * 5, fatFloor);

  // Carbs: the remainder, floored at 100g/day. If the remainder comes up
  // short, pull fat back toward its floor to make room before ever
  // touching protein.
  let carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4 / 5) * 5;
  if (carbsG < 100 && fatG > fatFloor) {
    const gramsToFree = Math.min(Math.ceil(((100 - carbsG) * 4) / 9 / 5) * 5, fatG - fatFloor);
    fatG -= gramsToFree;
    carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4 / 5) * 5;
  }
  carbsG = Math.max(carbsG, 0);

  return { proteinG, fatG, carbsG };
}

export function avgProtein(checkin) {
  if (!checkin?.protein) return null;
  const nums = checkin.protein.filter((n) => typeof n === "number" && !Number.isNaN(n));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

// Shifts a macro target by a calorie delta — carbs move first, and only
// spill into fat once carbs would drop under the 100g floor. Protein is
// never touched here: it's the number everyone's supposed to hit, not a
// dial the weekly adjustment turns.
export function adjustMacros(macroTargets, deltaCalories) {
  let { protein, carbs, fat } = macroTargets;
  const carbFloor = 100;
  const deltaCarbG = Math.round(deltaCalories / 4 / 5) * 5;
  let newCarbs = carbs + deltaCarbG;
  if (newCarbs < carbFloor) {
    const shortfallCal = (carbFloor - newCarbs) * 4;
    newCarbs = carbFloor;
    fat = Math.max(0, fat - Math.round(shortfallCal / 9 / 5) * 5);
  }
  return { protein, carbs: Math.max(0, newCarbs), fat };
}

// "On plan" = within 5% of the calorie target AND (when protein was
// logged that day) within 10g of the protein target. A day with no
// calories logged doesn't count toward the denominator or the numerator
// — it's simply not evidence either way, but it still costs the day
// since the rulebook grades against all 7 days, not just logged ones.
export function checkinAdherence(checkin, macroTargets) {
  if (!macroTargets?.protein) return null;
  const targetCals = macroTargets.protein * 4 + macroTargets.carbs * 4 + macroTargets.fat * 9;
  const cals = checkin?.calories || [];
  const proteinLog = checkin?.protein || [];
  let onPlanDays = 0;
  let loggedDays = 0;
  for (let i = 0; i < 7; i++) {
    const c = cals[i];
    if (typeof c !== "number" || Number.isNaN(c)) continue;
    loggedDays++;
    const withinCals = Math.abs(c - targetCals) <= targetCals * 0.05;
    const p = proteinLog[i];
    const withinProtein = typeof p === "number" && !Number.isNaN(p) ? Math.abs(p - macroTargets.protein) <= 10 : true;
    if (withinCals && withinProtein) onPlanDays++;
  }
  if (loggedDays === 0) return null;
  return { pct: Math.round((onPlanDays / 7) * 100), onPlanDays, loggedDays, targetCals };
}

// Week-over-week weigh-in delta, most recent pair only — for display
// ("down 0.6 lb this week"), not for the multi-week pattern the
// adjustment logic below needs. Weekly-only weigh-ins (no daily log), so
// this is a week-over-week delta rather than a true 7-day rolling average.
export function weightTrend(checkins) {
  const weighed = checkins
    .filter((c) => typeof c.weigh_in === "number")
    .sort((a, b) => a.week_number - b.week_number);
  if (weighed.length < 2) return null;
  const a = weighed[weighed.length - 2];
  const b = weighed[weighed.length - 1];
  const weeks = b.week_number - a.week_number || 1;
  const deltaLb = +(b.weigh_in - a.weigh_in).toFixed(2);
  return { deltaLb, weeks, weeklyRate: +(deltaLb / weeks).toFixed(2), fromWeek: a.week_number, toWeek: b.week_number };
}

// progress = pounds moved toward goal per week, sign-normalized so
// "positive" always means "in the right direction" whether the plan is a
// cut or a gain — lets the slow/fast comparison below stay one-directional.
function progressSeries(checkins, losing) {
  const weighed = checkins
    .filter((c) => typeof c.weigh_in === "number")
    .sort((a, b) => a.week_number - b.week_number);
  const series = [];
  for (let i = 1; i < weighed.length; i++) {
    const a = weighed[i - 1];
    const b = weighed[i];
    const weeks = b.week_number - a.week_number || 1;
    const delta = b.weigh_in - a.weigh_in;
    series.push({ week: b.week_number, progress: (losing ? -delta : delta) / weeks });
  }
  return series;
}

const RATE_TOLERANCE = 0.15; // lb/wk band around target counted as "on target"

// The weekly-adjustment recommendation — coached tiers only, and only
// once a coach-set macro target exists to adjust. Reads as a suggestion
// for the coach to review and apply (via /api/plan/adjust), never applied
// automatically. Deliberately narrower than the full rulebook: no daily
// weigh-ins (weekly-only, per how this app collects them), no waist/hip
// measurements, and no hunger/sleep/mood/training ratings — those aren't
// collected yet, so the "3 weeks flat + good adherence" plateau check
// here is scale-and-adherence only, not the full multi-signal version.
export function weeklyAdjustment(lead, checkins, plan) {
  if (!plan?.ok) return { status: "no-plan" };
  if (!lead.macro_targets?.protein) return { status: "no-target" };
  if (lead.diet_break_until && new Date(lead.diet_break_until) > new Date()) {
    return { status: "on-break", until: lead.diet_break_until };
  }

  const series = progressSeries(checkins, plan.losing);
  if (series.length < 2) return { status: "not-enough-data" };

  const history = checkins.filter((c) => c.week_number > 1).sort((a, b) => b.week_number - a.week_number);
  const adherence = checkinAdherence(history[0], lead.macro_targets);
  const trend = weightTrend(checkins);

  const target = plan.weeklyLbs;
  const classify = (r) => (r.progress < target - RATE_TOLERANCE ? "slow" : r.progress > target + RATE_TOLERANCE ? "fast" : "on-target");
  const last = series[series.length - 1];
  const lastClass = classify(last);
  const prevClass = series.length >= 2 ? classify(series[series.length - 2]) : null;
  const lowAdherence = adherence != null && adherence.pct < 80;

  // A real plateau, per the rulebook, needs 3+ weeks essentially flat —
  // not just "slower than the target rate" — plus adherence holding up,
  // otherwise a slow patch reads as a plateau prematurely.
  const flat = (r) => Math.abs(r.progress) < 0.15;
  const stalled = series.length >= 3 && series.slice(-3).every(flat) && !lowAdherence;

  let action, reason;
  if (lowAdherence) {
    action = "hold";
    reason = `Adherence was ${adherence.pct}% this week, under the 80% line — the plan doesn't need to change, the tracking does. Hold here and get logging solid before adjusting anything.`;
  } else if (stalled) {
    action = "diet-break";
    reason = "Three weeks flat despite solid adherence — that's a real plateau. First move is a diet break, not a deeper cut: two weeks at maintenance, then back to it.";
  } else if (lastClass === "on-target") {
    action = "hold";
    reason = "Right on target — hold the current numbers.";
  } else if (lastClass === "slow" && prevClass === "slow") {
    action = "cut-100";
    reason = "Two weeks slower than target. Pull 100 calories from carbs (fat if carbs are already tight), or add 2,000 steps instead of touching food.";
  } else if (lastClass === "fast") {
    action = "add-100";
    reason = "Ahead of target — add 100 calories back so the rate stays sustainable.";
  } else {
    action = "hold";
    reason = "One slower week isn't a pattern yet — hold and see how next week lands.";
  }

  return { status: "ready", action, reason, adherence, trend, targetRate: target };
}
