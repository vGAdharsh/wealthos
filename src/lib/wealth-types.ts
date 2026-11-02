/** Wealth-domain types (Phase 3). Amounts are integer paise. */

import type { Paise } from "./money";

export type InvestmentType =
  | "mutual_fund"
  | "sip"
  | "equity"
  | "etf"
  | "fixed_deposit"
  | "recurring_deposit"
  | "bond"
  | "government_scheme"
  | "other";

export const INVESTMENT_TYPES: { value: InvestmentType; label: string }[] = [
  { value: "mutual_fund", label: "Mutual fund" },
  { value: "sip", label: "SIP" },
  { value: "equity", label: "Direct equity" },
  { value: "etf", label: "ETF" },
  { value: "fixed_deposit", label: "Fixed deposit" },
  { value: "recurring_deposit", label: "Recurring deposit" },
  { value: "bond", label: "Bond" },
  { value: "government_scheme", label: "Government savings scheme" },
  { value: "other", label: "Other" },
];

export type Investment = {
  id: string;
  name: string;
  investmentType: InvestmentType;
  institution: string | null;
  purchaseDate: string | null;
  investedAmountPaise: Paise;
  units: string | null; // decimal string, never float
  navOrPrice: string | null;
  currentValuePaise: Paise; // user-entered valuation
  valuationAsOf: string | null;
  maturityDate: string | null;
  interestRate: string | null;
  notes: string | null;
};

export type InvestmentInput = Omit<Investment, "id">;

export type InvestmentFlow = {
  id: string;
  investmentId: string;
  date: string;
  amountPaise: Paise;
  kind: "contribution" | "withdrawal";
};

export type AssetType =
  | "bank"
  | "cash"
  | "fixed_deposit"
  | "property"
  | "vehicle"
  | "gold"
  | "other";

export const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: "bank", label: "Bank balance" },
  { value: "cash", label: "Cash" },
  { value: "fixed_deposit", label: "Fixed deposit" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "gold", label: "Gold" },
  { value: "other", label: "Other" },
];

export type Asset = {
  id: string;
  assetType: AssetType;
  name: string;
  valuePaise: Paise;
  valuationAsOf: string | null;
  notes: string | null;
};

export type AssetInput = Omit<Asset, "id">;

export type LiabilityType =
  | "credit_card"
  | "personal_loan"
  | "home_loan"
  | "vehicle_loan"
  | "education_loan"
  | "other";

export const LIABILITY_TYPES: { value: LiabilityType; label: string }[] = [
  { value: "credit_card", label: "Credit card outstanding" },
  { value: "personal_loan", label: "Personal loan" },
  { value: "home_loan", label: "Home loan" },
  { value: "vehicle_loan", label: "Vehicle loan" },
  { value: "education_loan", label: "Education loan" },
  { value: "other", label: "Other debt" },
];

export type Liability = {
  id: string;
  liabilityType: LiabilityType;
  name: string;
  outstandingPaise: Paise;
  interestRate: string | null;
  emiAmountPaise: Paise | null;
  emiDueDay: number | null;
  notes: string | null;
};

export type LiabilityInput = Omit<Liability, "id">;

export type NetWorthSnapshot = {
  id: string;
  snapshotDate: string;
  totalAssetsPaise: Paise;
  totalLiabilitiesPaise: Paise;
  netWorthPaise: Paise;
};

export type GoalType =
  | "emergency_fund"
  | "vehicle"
  | "home"
  | "education"
  | "travel"
  | "retirement"
  | "wealth"
  | "custom";

export const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "vehicle", label: "Vehicle purchase" },
  { value: "home", label: "Home purchase" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "retirement", label: "Retirement" },
  { value: "wealth", label: "Wealth accumulation" },
  { value: "custom", label: "Custom" },
];

export type FinancialGoal = {
  id: string;
  name: string;
  goalType: GoalType;
  targetAmountPaise: Paise;
  currentAmountPaise: Paise;
  targetDate: string | null;
  priority: "low" | "medium" | "high";
  contributionFrequency: "monthly" | "quarterly" | "yearly" | "one_time";
  linkedAccount: string | null;
};

export type FinancialGoalInput = Omit<FinancialGoal, "id">;

export type CalendarEventType =
  | "salary"
  | "rent"
  | "utility"
  | "insurance"
  | "emi"
  | "sip"
  | "fd_maturity"
  | "card_due"
  | "savings"
  | "custom";

export const CALENDAR_EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: "salary", label: "Salary date" },
  { value: "rent", label: "Rent payment" },
  { value: "utility", label: "Utility bill" },
  { value: "insurance", label: "Insurance premium" },
  { value: "emi", label: "EMI payment" },
  { value: "sip", label: "SIP date" },
  { value: "fd_maturity", label: "FD maturity" },
  { value: "card_due", label: "Credit card due" },
  { value: "savings", label: "Savings contribution" },
  { value: "custom", label: "Custom reminder" },
];

export type CalendarEvent = {
  id: string;
  title: string;
  eventType: CalendarEventType;
  eventDate: string;
  recurrence: "none" | "monthly" | "quarterly" | "yearly";
  amountPaise: Paise | null;
  notes: string | null;
};

export type CalendarEventInput = Omit<CalendarEvent, "id">;

/** Needs/Wants classification (spec Part 5.3). */
export type NwClassification =
  | "essential_need"
  | "discretionary_want"
  | "mixed"
  | "uncertain";

export const NW_LABELS: Record<NwClassification, string> = {
  essential_need: "Essential need",
  discretionary_want: "Discretionary want",
  mixed: "Mixed / conditional",
  uncertain: "Uncertain — needs review",
};
