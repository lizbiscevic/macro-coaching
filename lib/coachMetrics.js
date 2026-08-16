import { computePlan, currentWeekNumber } from "@/lib/plan";

/* ------------------------------------------------------------------
   Per-client dashboard row + flags, computed in JS from a lead and
   its check-ins (already fetched in batches by app/coach/page.js —
   no per-client queries, no DB views). Mirrors the brief's coach
   dashboard spec: current week/phase, latest weigh-in, change since
   last, average calories this week, checked-in state, and two flags
   ("missed two check-ins", "weight moved the wrong way two weeks
   running").
-------------------------------------------------------------------*/

export function buildClientRow(lead, checkins) {
  const plan = computePlan(lead.form || {});
  if (!plan.ok) return { lead, plan: null, currentWeek: null, flags: [] };

  const currentWeek = currentWeekNumber(lead.start_date, plan.totalWeeks);
  const byWeek = new Map(checkins.map((c) => [c.week_number, c]));
  const thisWeek = byWeek.get(currentWeek);

  const avgCalories = (c) => {
    if (!c?.calories) return null;
    const nums = c.calories.filter((n) => typeof n === "number" && !Number.isNaN(n));
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
  };

  const weighed = checkins
    .filter((c) => typeof c.weigh_in === "number")
    .sort((a, b) => a.week_number - b.week_number);
  const latest = weighed[weighed.length - 1] || null;
  const prior = weighed[weighed.length - 2] || null;

  const flags = [];

  const lastTwoWeeks = [currentWeek - 1, currentWeek].filter((w) => w >= 1);
  if (lastTwoWeeks.length === 2 && lastTwoWeeks.every((w) => !byWeek.get(w))) {
    flags.push("missed-checkins");
  }

  if (weighed.length >= 3) {
    const [a, b, c] = weighed.slice(-3);
    const d1 = b.weigh_in - a.weigh_in;
    const d2 = c.weigh_in - b.weigh_in;
    const wrongWay = plan.losing ? d1 > 0 && d2 > 0 : d1 < 0 && d2 < 0;
    if (wrongWay) flags.push("wrong-direction");
  }

  return {
    lead,
    plan,
    currentWeek,
    checkedInThisWeek: Boolean(thisWeek),
    avgCaloriesThisWeek: avgCalories(thisWeek),
    latestWeighIn: latest?.weigh_in ?? null,
    changeSinceLast: latest && prior ? +(latest.weigh_in - prior.weigh_in).toFixed(1) : null,
    flags,
  };
}
