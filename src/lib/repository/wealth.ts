/** WealthProvider interface — investments, assets, liabilities, net worth, goals, calendar. */

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

export interface WealthProvider {
  listInvestments(): Promise<Investment[]>;
  createInvestment(input: InvestmentInput): Promise<Investment>;
  updateInvestment(id: string, patch: Partial<InvestmentInput>): Promise<void>;
  deleteInvestment(id: string): Promise<void>;

  listInvestmentFlows(investmentId?: string): Promise<InvestmentFlow[]>;
  createInvestmentFlow(
    input: Omit<InvestmentFlow, "id">,
  ): Promise<InvestmentFlow>;

  listAssets(): Promise<Asset[]>;
  createAsset(input: AssetInput): Promise<Asset>;
  updateAsset(id: string, patch: Partial<AssetInput>): Promise<void>;
  deleteAsset(id: string): Promise<void>;

  listLiabilities(): Promise<Liability[]>;
  createLiability(input: LiabilityInput): Promise<Liability>;
  updateLiability(id: string, patch: Partial<LiabilityInput>): Promise<void>;
  deleteLiability(id: string): Promise<void>;

  listNetWorthSnapshots(): Promise<NetWorthSnapshot[]>;
  /** Upserts today's snapshot (one per user per day). */
  saveNetWorthSnapshot(
    input: Omit<NetWorthSnapshot, "id">,
  ): Promise<NetWorthSnapshot>;

  listFinancialGoals(): Promise<FinancialGoal[]>;
  createFinancialGoal(input: FinancialGoalInput): Promise<FinancialGoal>;
  updateFinancialGoal(
    id: string,
    patch: Partial<FinancialGoalInput>,
  ): Promise<void>;
  deleteFinancialGoal(id: string): Promise<void>;

  listCalendarEvents(): Promise<CalendarEvent[]>;
  createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<void>;
}
