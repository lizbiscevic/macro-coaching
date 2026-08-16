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

export function computePlan(f) {
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
