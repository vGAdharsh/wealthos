/**
 * Forecasting with disclosed methods (spec Part 5.2). Deterministic only —
 * an LLM never invents a number here. When history is insufficient the
 * reason is returned instead of a figure.
 */

export type MonthlyTotal = { month: string; paise: number }; // month = YYYY-MM

export type Forecast =
  | {
      ok: true;
      monthlyPaise: number;
      totalPaise: number;
      monthsAhead: number;
      method: string;
      historyUsed: string[];
      limitations: string;
    }
  | { ok: false; reason: string; minimumNeeded: string };

/**
 * Next-N-month estimate = mean of the last 3 recorded months (pad missing
 * recent months with zero — no records means no spending recorded, which
 * IS the record in a manual-entry app; the limitation text says so).
 */
export function forecastFromMonthlyTotals(
  totals: MonthlyTotal[],
  monthsAhead: number,
): Forecast {
  if (totals.length < 3)
    return {
      ok: false,
      reason: `Only ${totals.length} month(s) of history — at least 3 months of records are needed to estimate a trend.`,
      minimumNeeded: "At least 3 months of records are needed for a disclosed, reproducible estimate.",
    };
  const sorted = [...totals].sort((a, b) => a.month.localeCompare(b.month)).slice(-3);
  const mean = sorted.reduce((s, t) => s + t.paise, 0);
  const monthly = Math.round(mean / sorted.length);
  return {
    ok: true,
    monthlyPaise: monthly,
    totalPaise: monthly * monthsAhead,
    monthsAhead,
    method: "Mean of the last 3 recorded months",
    historyUsed: sorted.map((t) => t.month),
    limitations:
      "Assumes recent behaviour continues; ignores seasonality, one-off income/expense spikes and any recurring-payment changes. Months with missing entries count as ₹0 for that month.",
  };
}

/** Flags a month whose category total exceeds 1.5× the prior 3-month mean. */
export function unusualCategories(
  monthlyCategoryTotals: Map<string, Map<string, number>>, // month → category → paise
  month: string,
): { category: string; monthPaise: number; baselinePaise: number; changeBps: number }[] {
  const current = monthlyCategoryTotals.get(month) ?? new Map();
  const priorMonths = [...monthlyCategoryTotals.keys()].filter((m) => m < month).slice(-3);
  const out: { category: string; monthPaise: number; baselinePaise: number; changeBps: number }[] = [];
  for (const [category, paise] of current) {
    const baselineValues = priorMonths
      .map((m) => monthlyCategoryTotals.get(m)?.get(category) ?? 0)
      .filter((v) => v > 0);
    if (baselineValues.length === 0) continue;
    const baseline = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    if (paise > baseline * 1.5 && paise - baseline > 10000) {
      out.push({
        category,
        monthPaise: paise,
        baselinePaise: Math.round(baseline),
        changeBps: Math.round(((paise - baseline) * 10000) / baseline),
      });
    }
  }
  return out.sort((a, b) => b.changeBps - a.changeBps);
}
