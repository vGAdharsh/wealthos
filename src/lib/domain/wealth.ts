/**
 * Wealth-domain calculations — pure, integer-exact, documented.
 */

import type { Paise } from "../money";

/**
 * Required per-period contribution to reach a goal. Linear, growth-free
 * assumption — deliberately transparent (spec 4.9: "transparent
 * mathematical calculations", "clearly label assumptions").
 */
export type ContributionPlan =
  | { feasible: true; perPeriodPaise: Paise; periods: number; periodsLabel: string; assumption: string }
  | { feasible: false; reason: string };

export function projectedGoalContribution(
  targetPaise: Paise,
  currentPaise: Paise,
  targetDate: string | null,
  frequency: "monthly" | "quarterly" | "yearly" | "one_time",
): ContributionPlan {
  const remaining = targetPaise - currentPaise;
  if (remaining <= 0)
    return { feasible: false, reason: "Goal already reached — no further contribution needed." };
  if (!targetDate)
    return {
      feasible: false,
      reason: "Set a target date to compute a required contribution. Progress tracking already works without one.",
    };
  const today = new Date();
  const target = new Date(`${targetDate}T00:00:00Z`);
  if (target <= today)
    return { feasible: false, reason: "Target date has passed — pick a future date to see a plan." };
  const days = Math.max(1, Math.round((target.getTime() - today.getTime()) / 86400000));
  const months = Math.max(1, Math.round(days / 30.44));
  const perPeriodMap = { monthly: { n: months, label: "month" }, quarterly: { n: Math.max(1, Math.round(months / 3)), label: "quarter" }, yearly: { n: Math.max(1, Math.round(months / 12)), label: "year" }, one_time: { n: 1, label: "one-time payment" } };
  const { n, label } = perPeriodMap[frequency];
  // ceil to the next paisa: never plan to under-save
  const perPeriod = Math.ceil(remaining / n);
  return {
    feasible: true,
    perPeriodPaise: perPeriod,
    periods: n,
    periodsLabel: label,
    assumption: `Linear plan: ${n} ${label}(s) until ${targetDate}, no assumed investment growth. This is arithmetic, not financial advice.`,
  };
}

/** Allocation shares in integer basis points (rounded to sum 10,000). */
export function allocationBps(items: { label: string; paise: Paise }[]): { label: string; paise: Paise; bps: number }[] {
  const total = items.reduce((s, i) => s + i.paise, 0);
  if (total <= 0) return items.map((i) => ({ ...i, bps: 0 }));
  const raw = items.map((i) => ({ ...i, exact: (i.paise * 10000) / total }));
  const floored = raw.map((r) => ({ ...r, bps: Math.floor(r.exact) }));
  let leftover = 10000 - floored.reduce((s, r) => s + r.bps, 0);
  for (const r of [...floored].sort((a, b) => b.exact - a.exact)) {
    if (leftover <= 0) break;
    r.bps += 1;
    leftover -= 1;
  }
  return floored.map(({ label, paise, bps }) => ({ label, paise, bps }));
}

/** Unrealised gain = current value − invested capital (can be negative). */
export function unrealisedGainPaise(investedPaise: Paise, currentPaise: Paise): Paise {
  return currentPaise - investedPaise;
}

/** Absolute return in basis points (null when nothing invested). */
export function absoluteReturnBps(investedPaise: Paise, currentPaise: Paise): number | null {
  if (investedPaise <= 0) return null;
  return Math.round(((currentPaise - investedPaise) * 10000) / investedPaise);
}
