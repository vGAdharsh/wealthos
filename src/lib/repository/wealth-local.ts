/** Local-mode wealth provider (browser storage, exact paise strings). */

import { toPaise } from "@/lib/money";
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


const KEYS = {
  investments: "wealthos-investments-v2",
  flows: "wealthos-invflows-v2",
  assets: "wealthos-assets-v2",
  liabilities: "wealthos-liabilities-v2",
  snapshots: "wealthos-nwsnapshots-v2",
  fgoals: "wealthos-fgoals-v2",
  calendar: "wealthos-calendarevents-v2",
} as const;

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
function write<T>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

// Stored shapes replace paise numbers with exact decimal strings.
type SInv = Omit<Investment, "investedAmountPaise" | "currentValuePaise"> & {
  investedAmount: string;
  currentValue: string;
};
type SFlow = Omit<InvestmentFlow, "amountPaise"> & { amount: string };
type SAsset = Omit<Asset, "valuePaise"> & { value: string };
type SLia = Omit<Liability, "outstandingPaise" | "emiAmountPaise"> & {
  outstanding: string;
  emiAmount: string | null;
};
type SGoal = Omit<
  FinancialGoal,
  "targetAmountPaise" | "currentAmountPaise"
> & { targetAmount: string; currentAmount: string };
type SEvent = Omit<CalendarEvent, "amountPaise"> & { amount: string | null };

function invToDomain(r: SInv): Investment {
  return {
    ...r,
    investedAmountPaise: toPaise(r.investedAmount),
    currentValuePaise: toPaise(r.currentValue),
  };
}

export class LocalWealth implements WealthProvider {
  listInvestments(): Promise<Investment[]> {
    return Promise.resolve(read<SInv>(KEYS.investments).map(invToDomain));
  }
  async createInvestment(input: InvestmentInput): Promise<Investment> {
    const row: SInv = {
      ...input,
      id: crypto.randomUUID(),
      investedAmount: toStored(input.investedAmountPaise),
      currentValue: toStored(input.currentValuePaise),
    };
    write(KEYS.investments, [...read<SInv>(KEYS.investments), row]);
    return invToDomain(row);
  }
  async updateInvestment(id: string, patch: Partial<InvestmentInput>): Promise<void> {
    const all = read<SInv>(KEYS.investments);
    const i = all.findIndex((x) => x.id === id);
    if (i === -1) throw new Error("Investment not found");
    const next = { ...all[i], ...patch } as SInv;
    if (patch.investedAmountPaise !== undefined) next.investedAmount = toStored(patch.investedAmountPaise);
    if (patch.currentValuePaise !== undefined) next.currentValue = toStored(patch.currentValuePaise);
    all[i] = next;
    write(KEYS.investments, all);
  }
  async deleteInvestment(id: string): Promise<void> {
    write(KEYS.investments, read<SInv>(KEYS.investments).filter((x) => x.id !== id));
    write(KEYS.flows, read<SFlow>(KEYS.flows).filter((f) => f.investmentId !== id));
  }

  listInvestmentFlows(): Promise<InvestmentFlow[]> {
    return Promise.resolve(
      read<SFlow>(KEYS.flows)
        .map((f) => ({ ...f, amountPaise: toPaise(f.amount) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
  async createInvestmentFlow(
    input: Omit<InvestmentFlow, "id">,
  ): Promise<InvestmentFlow> {
    const row: SFlow = { ...input, id: crypto.randomUUID(), amount: toStored(input.amountPaise) };
    write(KEYS.flows, [...read<SFlow>(KEYS.flows), row]);
    return { ...input, id: row.id };
  }

  listAssets(): Promise<Asset[]> {
    return Promise.resolve(
      read<SAsset>(KEYS.assets).map((a) => ({ ...a, valuePaise: toPaise(a.value) })),
    );
  }
  async createAsset(input: AssetInput): Promise<Asset> {
    const row: SAsset = { ...input, id: crypto.randomUUID(), value: toStored(input.valuePaise) };
    write(KEYS.assets, [...read<SAsset>(KEYS.assets), row]);
    return { ...input, id: row.id };
  }
  async updateAsset(id: string, patch: Partial<AssetInput>): Promise<void> {
    const all = read<SAsset>(KEYS.assets);
    const i = all.findIndex((x) => x.id === id);
    if (i === -1) throw new Error("Asset not found");
    const next = { ...all[i], ...patch } as SAsset;
    if (patch.valuePaise !== undefined) next.value = toStored(patch.valuePaise);
    all[i] = next;
    write(KEYS.assets, all);
  }
  async deleteAsset(id: string): Promise<void> {
    write(KEYS.assets, read<SAsset>(KEYS.assets).filter((x) => x.id !== id));
  }

  listLiabilities(): Promise<Liability[]> {
    return Promise.resolve(
      read<SLia>(KEYS.liabilities).map((l) => ({
        ...l,
        outstandingPaise: toPaise(l.outstanding),
        emiAmountPaise: l.emiAmount ? toPaise(l.emiAmount) : null,
      })),
    );
  }
  async createLiability(input: LiabilityInput): Promise<Liability> {
    const row: SLia = {
      ...input,
      id: crypto.randomUUID(),
      outstanding: toStored(input.outstandingPaise),
      emiAmount: input.emiAmountPaise !== null ? toStored(input.emiAmountPaise) : null,
    };
    write(KEYS.liabilities, [...read<SLia>(KEYS.liabilities), row]);
    return { ...input, id: row.id };
  }
  async updateLiability(id: string, patch: Partial<LiabilityInput>): Promise<void> {
    const all = read<SLia>(KEYS.liabilities);
    const i = all.findIndex((x) => x.id === id);
    if (i === -1) throw new Error("Liability not found");
    const next = { ...all[i], ...patch } as SLia;
    if (patch.outstandingPaise !== undefined) next.outstanding = toStored(patch.outstandingPaise);
    if (patch.emiAmountPaise !== undefined) next.emiAmount = patch.emiAmountPaise !== null ? toStored(patch.emiAmountPaise) : null;
    all[i] = next;
    write(KEYS.liabilities, all);
  }
  async deleteLiability(id: string): Promise<void> {
    write(KEYS.liabilities, read<SLia>(KEYS.liabilities).filter((x) => x.id !== id));
  }

  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
    return Promise.resolve(
      read<Omit<NetWorthSnapshot, "id"> & { id?: string }>(KEYS.snapshots)
        .map((s) => ({ ...s, id: s.id ?? crypto.randomUUID() }))
        .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate)),
    );
  }
  async saveNetWorthSnapshot(
    input: Omit<NetWorthSnapshot, "id">,
  ): Promise<NetWorthSnapshot> {
    const all = read<Omit<NetWorthSnapshot, "id"> & { id?: string }>(KEYS.snapshots);
    const existingIdx = all.findIndex((s) => s.snapshotDate === input.snapshotDate);
    const row = { ...input, id: existingIdx >= 0 ? all[existingIdx].id : crypto.randomUUID() };
    if (existingIdx >= 0) all[existingIdx] = row;
    else all.push(row);
    write(KEYS.snapshots, all);
    return row as NetWorthSnapshot;
  }

  listFinancialGoals(): Promise<FinancialGoal[]> {
    return Promise.resolve(
      read<SGoal>(KEYS.fgoals).map((g) => ({
        ...g,
        targetAmountPaise: toPaise(g.targetAmount),
        currentAmountPaise: toPaise(g.currentAmount),
      })),
    );
  }
  async createFinancialGoal(input: FinancialGoalInput): Promise<FinancialGoal> {
    const row: SGoal = {
      ...input,
      id: crypto.randomUUID(),
      targetAmount: toStored(input.targetAmountPaise),
      currentAmount: toStored(input.currentAmountPaise),
    };
    write(KEYS.fgoals, [...read<SGoal>(KEYS.fgoals), row]);
    return { ...input, id: row.id };
  }
  async updateFinancialGoal(id: string, patch: Partial<FinancialGoalInput>): Promise<void> {
    const all = read<SGoal>(KEYS.fgoals);
    const i = all.findIndex((x) => x.id === id);
    if (i === -1) throw new Error("Goal not found");
    const next = { ...all[i], ...patch } as SGoal;
    if (patch.targetAmountPaise !== undefined) next.targetAmount = toStored(patch.targetAmountPaise);
    if (patch.currentAmountPaise !== undefined) next.currentAmount = toStored(patch.currentAmountPaise);
    all[i] = next;
    write(KEYS.fgoals, all);
  }
  async deleteFinancialGoal(id: string): Promise<void> {
    write(KEYS.fgoals, read<SGoal>(KEYS.fgoals).filter((x) => x.id !== id));
  }

  listCalendarEvents(): Promise<CalendarEvent[]> {
    return Promise.resolve(
      read<SEvent>(KEYS.calendar)
        .map((e) => ({ ...e, amountPaise: e.amount ? toPaise(e.amount) : null }))
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    );
  }
  async createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const row: SEvent = {
      ...input,
      id: crypto.randomUUID(),
      amount: input.amountPaise !== null ? toStored(input.amountPaise) : null,
    };
    write(KEYS.calendar, [...read<SEvent>(KEYS.calendar), row]);
    return { ...input, id: row.id };
  }
  async deleteCalendarEvent(id: string): Promise<void> {
    write(KEYS.calendar, read<SEvent>(KEYS.calendar).filter((x) => x.id !== id));
  }
}

/** Exact paise → "1234.56" string (no float arithmetic). */
export function toStored(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
