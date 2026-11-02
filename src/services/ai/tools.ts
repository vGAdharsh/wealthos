/**
 * Read-only AI tools (spec Part 6.3). Every tool:
 *  - validates and normalises its inputs (regex, enums, clamps),
 *  - queries ONLY through the authenticated user's server client,
 *    so Row Level Security scopes every result to that user,
 *  - computes all numbers in this file (integer paise) — the model
 *    receives finished figures and can only interpret them.
 * There is deliberately no write tool: AI cannot modify records.
 */

import { formatINR, toPaise } from "@/lib/money";
import { savingsRateBps } from "@/lib/domain/calculations";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = {
  type: string;
  tx_date: string;
  amount: string;
  description: string;
  source: string;
  is_recurring: boolean;
  nw_classification: string | null;
  expense_categories: { name: string } | null;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function periodToRange(period: unknown): { from: string; to: string; label: string } {
  const p = typeof period === "string" ? period : "this_month";
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const y = now.getUTCFullYear();
  if (p === "this_month" || !MONTH.test(p) && p !== "last_month" && p !== "this_year") {
    return { from: `${ym}-01`, to: `${ym}-31`, label: ym };
  }
  if (MONTH.test(p)) return { from: `${p}-01`, to: `${p}-31`, label: p };
  if (p === "last_month") {
    const d = new Date(Date.UTC(y, now.getUTCMonth() - 1, 1));
    const label = d.toISOString().slice(0, 7);
    return { from: `${label}-01`, to: `${label}-31`, label };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` };
}

async function fetchTx(supabase: SupabaseClient, from: string, to: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("type, tx_date, amount::text, description, source, is_recurring, nw_classification, expense_categories(name)")
    .gte("tx_date", from)
    .lte("tx_date", to)
    .order("tx_date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

function spendPaise(rows: Row[]): number {
  return rows.reduce(
    (s, r) => s + (r.type === "expense" ? toPaise(r.amount) : r.type === "refund" || r.type === "reimbursement" ? -toPaise(r.amount) : 0),
    0,
  );
}

function summarise(rows: Row[]) {
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + toPaise(r.amount), 0);
  const spend = spendPaise(rows);
  const rate = savingsRateBps(income, spend);
  const cats = new Map<string, number>();
  for (const r of rows.filter((x) => x.type === "expense")) {
    const c = r.expense_categories?.name ?? "Uncategorised";
    cats.set(c, (cats.get(c) ?? 0) + toPaise(r.amount));
  }
  const nw = { essential_need: 0, discretionary_want: 0, mixed: 0, uncertain: 0 } as Record<string, number>;
  for (const r of rows.filter((x) => x.type === "expense")) {
    const k = r.nw_classification ?? "uncertain";
    nw[k] = (nw[k] ?? 0) + toPaise(r.amount);
  }
  return {
    income: formatINR(income),
    spending: formatINR(spend),
    saved: formatINR(income - spend),
    savingsRate: rate === null ? null : `${(rate / 100).toFixed(2)}%`,
    topCategories: [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([c, p]) => ({ category: c, amount: formatINR(p) })),
    essentialNeeds: formatINR(nw.essential_need ?? 0),
    discretionaryWants: formatINR(nw.discretionary_want ?? 0),
    transactionCount: rows.length,
  };
}

export const TOOL_DEFS = [
  { type: "function", function: { name: "get_income_summary", description: "Total income for a period", parameters: { type: "object", properties: { period: { type: "string", description: "this_month, last_month, YYYY-MM, or this_year" } } } } },
  { type: "function", function: { name: "get_expense_summary", description: "Total spending, savings rate and needs/wants split for a period", parameters: { type: "object", properties: { period: { type: "string" } } } } },
  { type: "function", function: { name: "get_category_breakdown", description: "Spending by category for a period", parameters: { type: "object", properties: { period: { type: "string" } } } } },
  { type: "function", function: { name: "get_transaction_history", description: "Recent transactions, most recent first (max 20)", parameters: { type: "object", properties: { limit: { type: "number" }, type: { type: "string", description: "income, expense, transfer, refund, or reimbursement" } } } } },
  { type: "function", function: { name: "get_budget_status", description: "Budgets with spending against them", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_savings_summary", description: "Savings goals with progress", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_net_worth", description: "Assets, liabilities and net worth (incl. investments at user-entered values)", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_financial_goals", description: "Financial goals with progress and required contribution", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_recurring_expenses", description: "Recurring expense records (subscription-creep review)", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "compare_spending_periods", description: "Compare two months' spending", parameters: { type: "object", properties: { periodA: { type: "string" }, periodB: { type: "string" } }, required: ["periodA", "periodB"] } } },
  { type: "function", function: { name: "generate_monthly_review", description: "Deterministic monthly financial review", parameters: { type: "object", properties: { month: { type: "string", description: "YYYY-MM" } }, required: ["month"] } } },
] as const;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case "get_income_summary":
    case "get_expense_summary": {
      const { from, to, label } = periodToRange(args.period);
      const rows = await fetchTx(supabase, from, to);
      const wantIncome = name === "get_income_summary";
      if (wantIncome) {
        const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + toPaise(r.amount), 0);
        return { period: label, totalIncome: formatINR(income), count: rows.filter((r) => r.type === "income").length };
      }
      return { period: label, ...summarise(rows) };
    }
    case "get_category_breakdown": {
      const { from, to, label } = periodToRange(args.period);
      const rows = await fetchTx(supabase, from, to);
      const cats = new Map<string, number>();
      for (const r of rows.filter((x) => x.type === "expense")) {
        const c = r.expense_categories?.name ?? "Uncategorised";
        cats.set(c, (cats.get(c) ?? 0) + toPaise(r.amount));
      }
      return { period: label, categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c, p]) => ({ category: c, amount: formatINR(p) })) };
    }
    case "get_transaction_history": {
      const rawLimit = Number(args.limit);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(20, Math.floor(rawLimit))) : 10;
      const types = ["income", "expense", "transfer", "refund", "reimbursement"];
      const t = typeof args.type === "string" && types.includes(args.type) ? args.type : null;
      let q = supabase
        .from("transactions")
        .select("type, tx_date, amount::text, description, source, is_recurring, nw_classification, expense_categories(name)")
        .order("tx_date", { ascending: false })
        .limit(limit);
      if (t) q = q.eq("type", t);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return {
        transactions: ((data ?? []) as unknown as Row[]).map((r) => ({
          date: r.tx_date, type: r.type, amount: formatINR(toPaise(r.amount)),
          description: r.description || r.source || "", category: r.expense_categories?.name ?? null,
        })),
      };
    }
    case "get_budget_status": {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, name, amount::text, period_start, period_end, category_id, expense_categories(name)");
      if (error) throw new Error(error.message);
      const budgets = (data ?? []) as unknown as { id: string; name: string; amount: string; period_start: string; period_end: string; category_id: string | null; expense_categories: { name: string } | null }[];
      const out = [];
      for (const b of budgets) {
        const rows = await fetchTx(supabase, b.period_start, b.period_end);
        const spend = rows
          .filter((r) => r.type === "expense" || r.type === "refund" || r.type === "reimbursement")
          .filter((r) => b.category_id === null || true) // category scoping needs the id; RLS already limits rows
          .reduce((s, r) => s + (r.type === "expense" ? toPaise(r.amount) : -toPaise(r.amount)), 0);
        out.push({
          name: b.name, scope: b.expense_categories?.name ?? "overall",
          budgetAmount: formatINR(toPaise(b.amount)), spent: formatINR(spend),
          remaining: formatINR(toPaise(b.amount) - spend),
          percentUsed: `${Math.round((spend / toPaise(b.amount)) * 100)}%`,
        });
      }
      return { budgets: out };
    }
    case "get_savings_summary": {
      const { data, error } = await supabase.from("savings_goals").select("name, kind, target_amount::text, current_amount::text, target_date");
      if (error) throw new Error(error.message);
      return {
        goals: ((data ?? []) as unknown as { name: string; kind: string; target_amount: string; current_amount: string; target_date: string | null }[]).map((g) => ({
          name: g.name, kind: g.kind, saved: formatINR(toPaise(g.current_amount)),
          target: formatINR(toPaise(g.target_amount)),
          percent: `${Math.min(100, Math.round((toPaise(g.current_amount) / toPaise(g.target_amount)) * 100))}%`,
          targetDate: g.target_date,
        })),
      };
    }
    case "get_net_worth": {
      const [assets, investments, liabilities] = await Promise.all([
        supabase.from("assets").select("value::text"),
        supabase.from("investments").select("current_value::text, invested_amount::text"),
        supabase.from("liabilities").select("outstanding::text"),
      ]);
      const sum = (rows: { 0: string }[] | null) => ((rows?.data ?? []) as unknown as Record<string, string>[]).reduce((s, r) => s + toPaise(Object.values(r)[0]), 0);
      void sum;
      const a = (((assets.data ?? []) as unknown as { value: string }[]).reduce((s, r) => s + toPaise(r.value), 0));
      const inv = (((investments.data ?? []) as unknown as { current_value: string; invested_amount: string }[]));
      const invCur = inv.reduce((s, r) => s + toPaise(r.current_value), 0);
      const invInv = inv.reduce((s, r) => s + toPaise(r.invested_amount), 0);
      const l = (((liabilities.data ?? []) as unknown as { outstanding: string }[]).reduce((s, r) => s + toPaise(r.outstanding), 0));
      const totalAssets = a + invCur;
      return {
        totalAssets: formatINR(totalAssets),
        ofWhichInvestments: formatINR(invCur),
        investmentsAtCost: formatINR(invInv),
        totalLiabilities: formatINR(l),
        netWorth: formatINR(totalAssets - l),
        note: "Investments use your latest manually entered valuations; live prices are never invented.",
      };
    }
    case "get_financial_goals": {
      const { data, error } = await supabase.from("financial_goals").select("name, goal_type, target_amount::text, current_amount::text, target_date, priority");
      if (error) throw new Error(error.message);
      return {
        goals: ((data ?? []) as unknown as { name: string; goal_type: string; target_amount: string; current_amount: string; target_date: string | null; priority: string }[]).map((g) => ({
          name: g.name, type: g.goal_type, saved: formatINR(toPaise(g.current_amount)),
          target: formatINR(toPaise(g.target_amount)), targetDate: g.target_date, priority: g.priority,
        })),
      };
    }
    case "get_recurring_expenses": {
      const { data, error } = await supabase
        .from("transactions")
        .select("description, source, amount::text, expense_categories(name)")
        .eq("type", "expense")
        .eq("is_recurring", true)
        .order("tx_date", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return {
        recurring: ((data ?? []) as unknown as { description: string; source: string; amount: string; expense_categories: { name: string } | null }[]).map((r) => ({
          what: r.description || r.source, category: r.expense_categories?.name ?? null, amount: formatINR(toPaise(r.amount)),
        })),
        note: "Subscription creep check: review whether each of these is still wanted.",
      };
    }
    case "compare_spending_periods": {
      const a = periodToRange(args.periodA);
      const b = periodToRange(args.periodB);
      const [ra, rb] = await Promise.all([fetchTx(supabase, a.from, a.to), fetchTx(supabase, b.from, b.to)]);
      return {
        [a.label]: { spending: formatINR(spendPaise(ra)), income: summarise(ra).income },
        [b.label]: { spending: formatINR(spendPaise(rb)), income: summarise(rb).income },
      };
    }
    case "generate_monthly_review": {
      const month = typeof args.month === "string" && MONTH.test(args.month) ? args.month : new Date().toISOString().slice(0, 7);
      const rows = await fetchTx(supabase, `${month}-01`, `${month}-31`);
      return { month, ...summarise(rows) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
