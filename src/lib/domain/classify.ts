/**
 * Needs vs Wants classification (spec Part 5.3).
 *
 * NOT a simplistic category=class lookup. A layered, explainable engine:
 *   1. Category base class with an explicit reason string,
 *   2. Context overrides (work/medical/essential keywords, unusual size),
 *   3. Confidence + "needs user review" where evidence is thin.
 * Users can always override; overrides are stored on the record and never
 * silently changed. Language is factual, never shaming.
 */

import type { NwClassification } from "@/lib/wealth-types";

export type ClassificationResult = {
  classification: NwClassification;
  confidence: "high" | "low";
  reasoning: string;
};

const ESSENTIAL_CATEGORIES = [
  "Healthcare",
  "Insurance",
  "Housing & Rent",
  "Utilities",
  "Education",
  "Financial Obligations",
];
const WANT_CATEGORIES = [
  "Food & Dining",
  "Entertainment",
  "Subscriptions",
  "Shopping",
  "Travel",
  "Personal Care",
];
const CONTEXT_ESSENTIAL = /work|office|uniform|commute|medicine|medical|emergency|essential|repair/i;
const CONTEXT_LEISURE = /trip|holiday|tour|vacation|leisure|party|luxury|gift/i;

export function classifyNeedsWants(input: {
  categoryName: string | null;
  amountPaise: number;
  description?: string;
  source?: string;
  isRecurring?: boolean;
  /** Median expense size, used to flag unusual amounts. */
  medianExpensePaise?: number | null;
}): ClassificationResult {
  const cat = (input.categoryName ?? "").trim();
  const text = `${input.description ?? ""} ${input.source ?? ""}`;
  const base = (c: NwClassification, reasoning: string, confidence: "high" | "low" = "high"): ClassificationResult => ({ classification: c, confidence, reasoning });

  if (!cat && !text.trim())
    return base("uncertain", "No category and no description — please classify this transaction.", "low");

  // Context first: an explicit essential/leisure signal outweighs the category default.
  if (CONTEXT_ESSENTIAL.test(text))
    return base("mixed", `Mentioned “${(text.match(CONTEXT_ESSENTIAL) as RegExpMatchArray)[0]}”, which suggests a work or essential context for a “${cat || "unspecified"}” purchase — please confirm.`, "low");
  if (CONTEXT_LEISURE.test(text))
    return base("discretionary_want", `Mentioned “${(text.match(CONTEXT_LEISURE) as RegExpMatchArray)[0]}”, which indicates leisure or gifting.`, "high");

  if (ESSENTIAL_CATEGORIES.includes(cat))
    return base("essential_need", `${cat} is a core obligation or essential service.`, "high");

  if (cat === "Groceries") {
    if (input.medianExpensePaise && input.amountPaise > input.medianExpensePaise * 3 && input.amountPaise > 200000)
      return base("mixed", "Unusually large grocery purchase — could include premium or luxury items alongside basics.", "low");
    return base("essential_need", "Everyday groceries are a basic need; premium items inside a large bill would be discretionary.", "high");
  }

  if (cat === "Transportation" || cat === "Fuel")
    return base("essential_need", "Getting to work and daily errands is generally essential; leisure travel is treated separately under Travel.", "high");

  if (WANT_CATEGORIES.includes(cat)) {
    if (input.isRecurring && cat === "Subscriptions")
      return base("discretionary_want", "Recurring subscription — worth reviewing periodically for creep.", "high");
    return base("discretionary_want", `${cat} is chosen spending rather than an obligation.`, "high");
  }

  if (cat === "Family")
    return base("mixed", "Family support can be obligation or choice depending on circumstances — please classify.", "low");

  return base("uncertain", "Not enough context to classify confidently — please review.", "low");
}
