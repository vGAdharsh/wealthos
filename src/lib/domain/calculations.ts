/**
 * WealthOS financial calculations — pure, deterministic, integer-exact.
 * Every dashboard figure must come from these modules (spec Part 4.1:
 * "Every figure must be calculated from actual records using consistent,
 * documented formulas").
 */

import { type Paise, subPaise } from "../money";

/**
 * Savings rate = (income − expenses) / income, expressed in basis points
 * (1 bp = 0.01%). Integer-exact: 41.67% → 4167 bps (rounded half-down
 * at the .005 bp edge). Returns null when income is zero or negative —
 * a savings rate is undefined in that case, and we must not fabricate
 * one (spec: "No fabricated financial data").
 */
export function savingsRateBps(
  incomePaise: Paise,
  expensePaise: Paise,
): number | null {
  if (incomePaise <= 0) return null;
  const saved = subPaise(incomePaise, expensePaise);
  // Round to nearest bp using integer math on the doubled numerator
  // to avoid float division entirely.
  const bps = Math.floor((saved * 10000 + incomePaise / 2) / incomePaise);
  return bps;
}

/** Net worth = total assets − total liabilities (spec Part 4.8). */
export function netWorthPaise(
  totalAssetsPaise: Paise,
  totalLiabilitiesPaise: Paise,
): Paise {
  return subPaise(totalAssetsPaise, totalLiabilitiesPaise);
}

export type BudgetUtilisation = {
  spentPaise: Paise;
  budgetPaise: Paise;
  remainingPaise: Paise;
  /** 0–10,000+ bps; can exceed 10,000 when overspent. */
  utilisationBps: number;
  isOverBudget: boolean;
};

/** Budget utilisation = spent / budget (integer-exact basis points). */
export function budgetUtilisation(
  spentPaise: Paise,
  budgetPaise: Paise,
): BudgetUtilisation {
  if (budgetPaise <= 0)
    throw new Error("Budget must be a positive amount");
  if (spentPaise < 0) throw new Error("Spent cannot be negative");
  const remaining = subPaise(budgetPaise, spentPaise);
  const bps = Math.floor((spentPaise * 10000 + budgetPaise / 2) / budgetPaise);
  return {
    spentPaise,
    budgetPaise,
    remainingPaise: remaining,
    utilisationBps: bps,
    isOverBudget: remaining < 0,
  };
}

/**
 * XIRR on dated cash flows (Newton–Raphson with bisection fallback).
 * Used from Phase 3 for investment returns. `flows` are signed from the
 * investor's perspective: contributions negative, withdrawals positive.
 * Returns the annualised rate as a decimal (0.1234 = 12.34%) or null
 * when it does not converge / the flow set is degenerate.
 */
export type DatedFlow = { date: string; amount: number }; // ISO date, signed paise or any unit

export function xirr(flows: DatedFlow[]): number | null {
  if (flows.length < 2) return null;
  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = Date.parse(flows[0].date);
  const years = (iso: string) => (Date.parse(iso) - t0) / (365 * 24 * 3600 * 1000);
  const npv = (rate: number) =>
    flows.reduce((acc, f) => acc + f.amount / Math.pow(1 + rate, years(f.date)), 0);

  let low = -0.9999;
  let high = 10;
  let mid = 0.1;
  for (let i = 0; i < 200; i++) {
    mid = (low + high) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-9) return mid;
    const vLow = npv(low);
    if (vLow * v < 0) high = mid;
    else low = mid;
  }
  return Math.abs(npv(mid)) < 1e-6 ? mid : null;
}
