import { describe, expect, it } from "vitest";
import {
  budgetUtilisation,
  netWorthPaise,
  savingsRateBps,
  xirr,
} from "./calculations";

describe("savingsRateBps — spec Part 12 worked example", () => {
  it("₹60,000 income, ₹35,000 expenses → ₹25,000 saved, 41.67%", () => {
    const income = 6_000_000; // ₹60,000.00
    const expenses = 3_500_000; // ₹35,000.00
    const bps = savingsRateBps(income, expenses);
    expect(bps).toBe(4167); // 41.67%
  });
  it("returns null instead of fabricating a rate without income", () => {
    expect(savingsRateBps(0, 1_000)).toBeNull();
    expect(savingsRateBps(-5, 1_000)).toBeNull();
  });
  it("handles saving nothing and overspending", () => {
    expect(savingsRateBps(1_000, 1_000)).toBe(0);
    expect(savingsRateBps(1_000, 1_500)).toBe(-5000);
  });
});

describe("netWorthPaise — assets minus liabilities, never income minus expenses", () => {
  it("follows spec Part 12", () => {
    expect(netWorthPaise(10_000_000, 4_000_000)).toBe(6_000_000);
  });
  it("goes negative correctly", () => {
    expect(netWorthPaise(1_000, 2_500)).toBe(-1_500);
  });
});

describe("budgetUtilisation", () => {
  it("computes utilisation and remaining exactly", () => {
    const r = budgetUtilisation(2_500_000, 10_000_000);
    expect(r.utilisationBps).toBe(2500);
    expect(r.remainingPaise).toBe(7_500_000);
    expect(r.isOverBudget).toBe(false);
  });
  it("flags overspending beyond 100%", () => {
    const r = budgetUtilisation(1_100_000, 1_000_000);
    expect(r.utilisationBps).toBe(11000);
    expect(r.isOverBudget).toBe(true);
  });
  it("rejects nonsensical budgets", () => {
    expect(() => budgetUtilisation(100, 0)).toThrow();
    expect(() => budgetUtilisation(-1, 100)).toThrow();
  });
});

describe("xirr — dated cash flows", () => {
  it("computes a simple annualised return", () => {
    // Invest ₹100,000; receive ₹110,000 exactly one year later → 10%.
    const rate = xirr([
      { date: "2025-01-01", amount: -100_000 },
      { date: "2026-01-01", amount: 110_000 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate! > 0.099 && rate! < 0.101).toBe(true);
  });
  it("returns null for degenerate flows (all one sign, too few)", () => {
    expect(xirr([{ date: "2025-01-01", amount: -100 }])).toBeNull();
    expect(
      xirr([
        { date: "2025-01-01", amount: -100 },
        { date: "2026-01-01", amount: -50 },
      ]),
    ).toBeNull();
  });
});
