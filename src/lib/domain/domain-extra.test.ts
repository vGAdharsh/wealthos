import { describe, expect, it } from "vitest";
import { projectedGoalContribution, allocationBps, absoluteReturnBps } from "./wealth";
import { forecastFromMonthlyTotals, unusualCategories } from "./forecast";
import { classifyNeedsWants } from "./classify";

describe("projectedGoalContribution — transparent goal math", () => {
  it("rounds up to the next paisa and labels assumptions", () => {
    const plan = projectedGoalContribution(600_000_00, 100_000_00, "2027-11-02", "monthly");
    expect(plan.feasible).toBe(true);
    if (plan.feasible) {
      expect((plan.perPeriodPaise * plan.periods)).toBeGreaterThanOrEqual(500_000_00);
      expect(plan.assumption).toContain("no assumed investment growth");
    }
  });
  it("refuses to fabricate a plan without a date", () => {
    const plan = projectedGoalContribution(100_000, 0, null, "monthly");
    expect(plan.feasible).toBe(false);
  });
  it("rejects past target dates and completed goals", () => {
    expect(projectedGoalContribution(100_000, 0, "2020-01-01", "monthly").feasible).toBe(false);
    expect(projectedGoalContribution(100_000, 200_000, "2027-01-01", "monthly").feasible).toBe(false);
  });
});

describe("allocationBps — sums to exactly 10,000", () => {
  it("distributes residue deterministically", () => {
    const parts = allocationBps([
      { label: "a", paise: 3333 },
      { label: "b", paise: 3333 },
      { label: "c", paise: 3334 },
    ]);
    expect(parts.reduce((s, p) => s + p.bps, 0)).toBe(10000);
  });
});

describe("absoluteReturnBps", () => {
  it("computes percent return exactly", () => {
    expect(absoluteReturnBps(100_000, 110_000)).toBe(1000); // +10%
    expect(absoluteReturnBps(0, 500)).toBeNull();
  });
});

describe("forecast — disclosed method, honest insufficiency", () => {
  it("refuses with a reason under 3 months of history", () => {
    const f = forecastFromMonthlyTotals([{ month: "2026-10", paise: 100 }], 1);
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.reason).toContain("3 months");
  });
  it("averages the last 3 recorded months and discloses method", () => {
    const f = forecastFromMonthlyTotals(
      [
        { month: "2026-07", paise: 300 },
        { month: "2026-08", paise: 300 },
        { month: "2026-09", paise: 300 },
        { month: "2026-10", paise: 600 },
      ],
      3,
    );
    expect(f.ok).toBe(true);
    if (f.ok) {
      expect(f.monthlyPaise).toBe(400);
      expect(f.totalPaise).toBe(1200);
      expect(f.method).toContain("last 3 recorded months");
    }
  });
  it("flags unusual categories above 1.5× baseline", () => {
    const data = new Map<string, Map<string, number>>([
      ["2026-08", new Map([["Food & Dining", 100_000]])],
      ["2026-09", new Map([["Food & Dining", 100_000]])],
      ["2026-10", new Map([["Food & Dining", 100_000]])],
      ["2026-11", new Map([["Food & Dining", 200_000]])],
    ]);
    const flags = unusualCategories(data, "2026-11");
    expect(flags.length).toBe(1);
    expect(flags[0].changeBps).toBe(10000); // +100%
  });
});

describe("classifyNeedsWants — explainable, context-aware", () => {
  it("essential categories classify high-confidence", () => {
    const r = classifyNeedsWants({ categoryName: "Healthcare", amountPaise: 50_000 });
    expect(r.classification).toBe("essential_need");
    expect(r.confidence).toBe("high");
    expect(r.reasoning).toContain("core obligation");
  });
  it("dining is a want, but work-lunch context makes it mixed", () => {
    expect(classifyNeedsWants({ categoryName: "Food & Dining", amountPaise: 30_000 }).classification).toBe("discretionary_want");
    const r = classifyNeedsWants({ categoryName: "Food & Dining", amountPaise: 30_000, description: "lunch at office cafeteria" });
    expect(r.classification).toBe("mixed");
  });
  it("large grocery bills become mixed, not shamed", () => {
    const r = classifyNeedsWants({ categoryName: "Groceries", amountPaise: 300_000, medianExpensePaise: 50_000 });
    expect(r.classification).toBe("mixed");
    expect(r.reasoning.toLowerCase()).not.toMatch(/should|shame|bad|waste/);
  });
  it("blank records ask the user instead of guessing", () => {
    const r = classifyNeedsWants({ categoryName: null, amountPaise: 10_000 });
    expect(r.classification).toBe("uncertain");
  });
});
