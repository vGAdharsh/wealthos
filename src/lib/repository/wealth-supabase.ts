/** Database-mode wealth provider. Numerics cross as TEXT — never floats. */

import { toPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { WealthProvider } from "./wealth";
import type {
  Asset,
  AssetInput,
  CalendarEvent,
  CalendarEventInput,
  FinancialGoal,
  FinancialGoalInput,
  Investment,
  InvestmentFlow,
  InvestmentInput,
  Liability,
  LiabilityInput,
  NetWorthSnapshot,
} from "@/lib/wealth-types";

type Row = Record<string, string | null>;

export class SupabaseWealth implements WealthProvider {
  listInvestments(): Promise<Investment[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("investments")
        .select("id, name, investment_type, institution, purchase_date, invested_amount::text, units, nav_or_price, current_value::text, valuation_as_of, maturity_date, interest_rate, notes")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        name: r.name,
        investmentType: r.investment_type,
        institution: r.institution,
        purchaseDate: r.purchase_date,
        investedAmountPaise: toPaise(r.invested_amount),
        units: r.units,
        navOrPrice: r.nav_or_price,
        currentValuePaise: toPaise(r.current_value),
        valuationAsOf: r.valuation_as_of,
        maturityDate: r.maturity_date,
        interestRate: r.interest_rate,
        notes: r.notes,
      })) as Investment[];
    });
  }
  createInvestment(input: InvestmentInput): Promise<Investment> {
    return run(async (db) => {
      const { data, error } = await db
        .from("investments")
        .insert(invToDb(input))
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ...input, id: (data as unknown as { id: string }).id };
    });
  }
  updateInvestment(id: string, patch: Partial<InvestmentInput>): Promise<void> {
    return run(async (db) => {
      const u: Row = {};
      if (patch.name !== undefined) u.name = patch.name;
      if (patch.investmentType !== undefined) u.investment_type = patch.investmentType;
      if (patch.institution !== undefined) u.institution = patch.institution;
      if (patch.purchaseDate !== undefined) u.purchase_date = patch.purchaseDate;
      if (patch.investedAmountPaise !== undefined) u.invested_amount = dec(patch.investedAmountPaise);
      if (patch.units !== undefined) u.units = patch.units;
      if (patch.navOrPrice !== undefined) u.nav_or_price = patch.navOrPrice;
      if (patch.currentValuePaise !== undefined) { u.current_value = dec(patch.currentValuePaise); u.valuation_as_of = patch.valuationAsOf ?? today(); }
      if (patch.maturityDate !== undefined) u.maturity_date = patch.maturityDate;
      if (patch.interestRate !== undefined) u.interest_rate = patch.interestRate;
      if (patch.notes !== undefined) u.notes = patch.notes;
      const { error } = await db.from("investments").update(u).eq("id", id);
      if (error) throw new Error(error.message);
    });
  }
  deleteInvestment(id: string): Promise<void> {
    return run(async (db) => {
      const { error } = await db.from("investments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  }

  listInvestmentFlows(): Promise<InvestmentFlow[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("investment_transactions")
        .select("id, investment_id, tx_date, amount::text, kind")
        .order("tx_date");
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        investmentId: r.investment_id,
        date: r.tx_date,
        amountPaise: toPaise(r.amount),
        kind: r.kind,
      })) as InvestmentFlow[];
    });
  }
  createInvestmentFlow(input: Omit<InvestmentFlow, "id">): Promise<InvestmentFlow> {
    return run(async (db) => {
      const { data, error } = await db
        .from("investment_transactions")
        .insert({ investment_id: input.investmentId, tx_date: input.date, amount: dec(input.amountPaise), kind: input.kind })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ...input, id: (data as unknown as { id: string }).id };
    });
  }

  listAssets(): Promise<Asset[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("assets")
        .select("id, asset_type, name, value::text, valuation_as_of, notes")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        assetType: r.asset_type,
        name: r.name,
        valuePaise: toPaise(r.value),
        valuationAsOf: r.valuation_as_of,
        notes: r.notes,
      })) as Asset[];
    });
  }
  createAsset(input: AssetInput): Promise<Asset> {
    return run(async (db) => db.insert("assets", assetToDb(input)));
  }
  updateAsset(id: string, patch: Partial<AssetInput>): Promise<void> {
    return run(async (db) => {
      const u: Row = {};
      if (patch.assetType !== undefined) u.asset_type = patch.assetType;
      if (patch.name !== undefined) u.name = patch.name;
      if (patch.valuePaise !== undefined) { u.value = dec(patch.valuePaise); u.valuation_as_of = patch.valuationAsOf ?? today(); }
      else if (patch.valuationAsOf !== undefined) u.valuation_as_of = patch.valuationAsOf;
      if (patch.notes !== undefined) u.notes = patch.notes;
      const { error } = await db.from("assets").update(u).eq("id", id);
      if (error) throw new Error(error.message);
    });
  }
  deleteAsset(id: string): Promise<void> {
    return run(async (db) => {
      const { error } = await db.from("assets").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  }

  listLiabilities(): Promise<Liability[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("liabilities")
        .select("id, liability_type, name, outstanding::text, interest_rate, emi_amount::text, emi_due_day, notes")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        liabilityType: r.liability_type,
        name: r.name,
        outstandingPaise: toPaise(r.outstanding),
        interestRate: r.interest_rate,
        emiAmountPaise: r.emi_amount ? toPaise(r.emi_amount) : null,
        emiDueDay: r.emi_due_day ? Number(r.emi_due_day) : null,
        notes: r.notes,
      })) as Liability[];
    });
  }
  createLiability(input: LiabilityInput): Promise<Liability> {
    return run(async (db) => db.insert("liabilities", liaToDb(input)));
  }
  updateLiability(id: string, patch: Partial<LiabilityInput>): Promise<void> {
    return run(async (db) => {
      const u: Row = {};
      if (patch.liabilityType !== undefined) u.liability_type = patch.liabilityType;
      if (patch.name !== undefined) u.name = patch.name;
      if (patch.outstandingPaise !== undefined) u.outstanding = dec(patch.outstandingPaise);
      if (patch.interestRate !== undefined) u.interest_rate = patch.interestRate;
      if (patch.emiAmountPaise !== undefined) u.emi_amount = patch.emiAmountPaise !== null ? dec(patch.emiAmountPaise) : null;
      if (patch.emiDueDay !== undefined) u.emi_due_day = patch.emiDueDay;
      if (patch.notes !== undefined) u.notes = patch.notes;
      const { error } = await db.from("liabilities").update(u).eq("id", id);
      if (error) throw new Error(error.message);
    });
  }
  deleteLiability(id: string): Promise<void> {
    return run(async (db) => {
      const { error } = await db.from("liabilities").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  }

  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("net_worth_snapshots")
        .select("id, snapshot_date, total_assets::text, total_liabilities::text, net_worth::text")
        .order("snapshot_date");
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        snapshotDate: r.snapshot_date,
        totalAssetsPaise: toPaise(r.total_assets),
        totalLiabilitiesPaise: toPaise(r.total_liabilities),
        netWorthPaise: toPaise(r.net_worth),
      })) as NetWorthSnapshot[];
    });
  }
  saveNetWorthSnapshot(input: Omit<NetWorthSnapshot, "id">): Promise<NetWorthSnapshot> {
    return run(async (db) => {
      const { data, error } = await db
        .from("net_worth_snapshots")
        .upsert(
          {
            snapshot_date: input.snapshotDate,
            total_assets: dec(input.totalAssetsPaise),
            total_liabilities: dec(input.totalLiabilitiesPaise),
            net_worth: dec(input.netWorthPaise),
          },
          { onConflict: "user_id,snapshot_date" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { ...input, id: (data as unknown as { id: string }).id };
    });
  }

  listFinancialGoals(): Promise<FinancialGoal[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("financial_goals")
        .select("id, name, goal_type, target_amount::text, current_amount::text, target_date, priority, contribution_frequency, linked_account")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map(goalFromDb) as FinancialGoal[];
    });
  }
  createFinancialGoal(input: FinancialGoalInput): Promise<FinancialGoal> {
    return run(async (db) => db.insert("financial_goals", goalToDb(input)));
  }
  updateFinancialGoal(id: string, patch: Partial<FinancialGoalInput>): Promise<void> {
    return run(async (db) => {
      const u: Row = {};
      if (patch.name !== undefined) u.name = patch.name;
      if (patch.goalType !== undefined) u.goal_type = patch.goalType;
      if (patch.targetAmountPaise !== undefined) u.target_amount = dec(patch.targetAmountPaise);
      if (patch.currentAmountPaise !== undefined) u.current_amount = dec(patch.currentAmountPaise);
      if (patch.targetDate !== undefined) u.target_date = patch.targetDate;
      if (patch.priority !== undefined) u.priority = patch.priority;
      if (patch.contributionFrequency !== undefined) u.contribution_frequency = patch.contributionFrequency;
      if (patch.linkedAccount !== undefined) u.linked_account = patch.linkedAccount;
      const { error } = await db.from("financial_goals").update(u).eq("id", id);
      if (error) throw new Error(error.message);
    });
  }
  deleteFinancialGoal(id: string): Promise<void> {
    return run(async (db) => {
      const { error } = await db.from("financial_goals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  }

  listCalendarEvents(): Promise<CalendarEvent[]> {
    return run(async (db) => {
      const { data, error } = await db
        .from("calendar_events")
        .select("id, title, event_type, event_date, recurrence, amount::text, notes")
        .order("event_date");
      if (error) throw new Error(error.message);
      return (data as unknown as Row[]).map((r) => ({
        id: r.id,
        title: r.title,
        eventType: r.event_type,
        eventDate: r.event_date,
        recurrence: r.recurrence,
        amountPaise: r.amount ? toPaise(r.amount) : null,
        notes: r.notes,
      })) as CalendarEvent[];
    });
  }
  createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    return run(async (db) => db.insert("calendar_events", eventToDb(input)));
  }
  deleteCalendarEvent(id: string): Promise<void> {
    return run(async (db) => {
      const { error } = await db.from("calendar_events").delete().eq("id", id);
      if (error) throw new Error(error.message);
    });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
/** Exact paise → decimal string, no float. */
function dec(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
type Db = ReturnType<typeof createClient> & { insert: (table: string, row: Row) => Promise<never> };

/** Runs a block against a fresh client; wraps errors uniformly. */
async function run<T>(fn: (db: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
  try {
    return await fn(createClient());
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}
// small helper used by the create* methods above
function makeInsert(fn: (db: ReturnType<typeof createClient>) => Promise<unknown>) {
  return fn;
}
void makeInsert;

function invToDb(i: InvestmentInput): Row {
  return {
    name: i.name,
    investment_type: i.investmentType,
    institution: i.institution,
    purchase_date: i.purchaseDate,
    invested_amount: dec(i.investedAmountPaise),
    units: i.units,
    nav_or_price: i.navOrPrice,
    current_value: dec(i.currentValuePaise),
    valuation_as_of: i.valuationAsOf,
    maturity_date: i.maturityDate,
    interest_rate: i.interestRate,
    notes: i.notes,
  };
}
function assetToDb(a: AssetInput): Row {
  return { asset_type: a.assetType, name: a.name, value: dec(a.valuePaise), valuation_as_of: a.valuationAsOf, notes: a.notes };
}
function liaToDb(l: LiabilityInput): Row {
  return {
    liability_type: l.liabilityType, name: l.name, outstanding: dec(l.outstandingPaise),
    interest_rate: l.interestRate, emi_amount: l.emiAmountPaise !== null ? dec(l.emiAmountPaise) : null,
    emi_due_day: l.emiDueDay, notes: l.notes,
  };
}
function goalToDb(g: FinancialGoalInput): Row {
  return {
    name: g.name, goal_type: g.goalType, target_amount: dec(g.targetAmountPaise),
    current_amount: dec(g.currentAmountPaise), target_date: g.targetDate, priority: g.priority,
    contribution_frequency: g.contributionFrequency, linked_account: g.linkedAccount,
  };
}
function goalFromDb(r: Row): FinancialGoal {
  return {
    id: r.id, name: r.name, goalType: r.goal_type,
    targetAmountPaise: toPaise(r.target_amount), currentAmountPaise: toPaise(r.current_amount),
    targetDate: r.target_date, priority: r.priority, contributionFrequency: r.contribution_frequency,
    linkedAccount: r.linked_account,
  } as FinancialGoal;
}
function eventToDb(e: CalendarEventInput): Row {
  return { title: e.title, event_type: e.eventType, event_date: e.eventDate, recurrence: e.recurrence, amount: e.amountPaise !== null ? dec(e.amountPaise) : null, notes: e.notes };
}
