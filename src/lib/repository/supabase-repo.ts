/**
 * Database-mode provider: Supabase PostgreSQL. Row Level Security does
 * the authorisation; this layer never sends or receives floats for
 * money — numerics cross as TEXT both ways (`amount::text` on select,
 * exact decimal string on write).
 */

import { toPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { paiseToStoredString } from "./local-repo";
import { SupabaseWealth } from "./wealth-supabase";
import type { DataProvider } from "./types";
import type {
  Budget,
  BudgetInput,
  Category,
  SavingsGoal,
  SavingsGoalInput,
  Transaction,
  TransactionInput,
  TxFilter,
} from "@/lib/types";

type DbTx = {
  id: string;
  user_id: string;
  type: Transaction["type"];
  tx_date: string;
  amount: string; // selected as amount::text
  description: string;
  source: string;
  category_id: string | null;
  payment_method: string | null;
  notes: string | null;
  is_recurring: boolean;
  content_hash: string;
  import_batch_id: string | null;
  nw_classification: string | null;
  nw_is_override: boolean;
  nw_reasoning: string | null;
  created_at: string;
  expense_categories: { name: string } | null;
};

type DbBudget = {
  id: string;
  name: string;
  category_id: string | null;
  amount: string;
  period_start: string;
  period_end: string;
  expense_categories: { name: string } | null;
};

type DbGoal = {
  id: string;
  name: string;
  kind: SavingsGoal["kind"];
  target_amount: string;
  current_amount: string;
  target_date: string | null;
};

function dbToTx(row: DbTx): Transaction {
  return {
    id: row.id,
    type: row.type,
    date: row.tx_date,
    amountPaise: toPaise(row.amount),
    description: row.description,
    source: row.source,
    categoryId: row.category_id,
    categoryName: row.expense_categories?.name ?? null,
    paymentMethod: row.payment_method,
    notes: row.notes,
    isRecurring: row.is_recurring,
    contentHash: row.content_hash,
    importBatchId: row.import_batch_id,
    nwClassification: row.nw_classification,
    nwIsOverride: row.nw_is_override,
    nwReasoning: row.nw_reasoning,
    createdAt: row.created_at,
  };
}

export class SupabaseProvider implements DataProvider {
  readonly mode = "database" as const;
  readonly wealth = new SupabaseWealth();

  async listTransactions(filter?: TxFilter): Promise<Transaction[]> {
    let q = createClient()
      .from("transactions")
      .select(
        "id, user_id, type, tx_date, amount::text, description, source, category_id, payment_method, notes, is_recurring, content_hash, import_batch_id, nw_classification, nw_is_override, nw_reasoning, created_at, expense_categories(name)",
      )
      .order("tx_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (filter?.types?.length)
      q = q.in("type", filter.types);
    if (filter?.from) q = q.gte("tx_date", filter.from);
    if (filter?.to) q = q.lte("tx_date", filter.to);
    if (filter?.categoryId) q = q.eq("category_id", filter.categoryId);
    const { data, error } = await q;
    if (error) throw new Error(`Could not load transactions: ${error.message}`);
    return (data as unknown as DbTx[]).map(dbToTx);
  }

  private static toDb(input: TransactionInput, userId: string) {
    return {
      user_id: userId,
      type: input.type,
      tx_date: input.date,
      amount: paiseToStoredString(input.amountPaise),
      description: input.description,
      source: input.source,
      category_id: input.categoryId,
      payment_method: input.paymentMethod,
      notes: input.notes,
      is_recurring: input.isRecurring,
      content_hash: input.contentHash,
      import_batch_id: input.importBatchId ?? null,
      nw_classification: input.nwClassification ?? null,
      nw_is_override: input.nwIsOverride ?? false,
      nw_reasoning: input.nwReasoning ?? null,
    };
  }

  async createTransaction(input: TransactionInput): Promise<Transaction> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("transactions")
      .insert(SupabaseProvider.toDb(input, user.id))
      .select(
        "id, user_id, type, tx_date, amount::text, description, source, category_id, payment_method, notes, is_recurring, content_hash, import_batch_id, nw_classification, nw_is_override, nw_reasoning, created_at, expense_categories(name)",
      )
      .single();
    if (error) throw new Error(`Could not save transaction: ${error.message}`);
    return dbToTx(data as unknown as DbTx);
  }

  async updateTransaction(
    id: string,
    patch: Partial<TransactionInput>,
  ): Promise<void> {
    const supabase = createClient();
    const update: Record<string, unknown> = {};
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.date !== undefined) update.tx_date = patch.date;
    if (patch.amountPaise !== undefined)
      update.amount = paiseToStoredString(patch.amountPaise);
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.source !== undefined) update.source = patch.source;
    if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
    if (patch.paymentMethod !== undefined)
      update.payment_method = patch.paymentMethod;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.isRecurring !== undefined) update.is_recurring = patch.isRecurring;
    if (patch.contentHash !== undefined) update.content_hash = patch.contentHash;
    if (patch.nwClassification !== undefined) update.nw_classification = patch.nwClassification;
    if (patch.nwIsOverride !== undefined) update.nw_is_override = patch.nwIsOverride;
    if (patch.nwReasoning !== undefined) update.nw_reasoning = patch.nwReasoning;
    const { error } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", id);
    if (error) throw new Error(`Could not update transaction: ${error.message}`);
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await createClient()
      .from("transactions")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Could not delete transaction: ${error.message}`);
  }

  async bulkCreateTransactions(inputs: TransactionInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");

    // Pre-filter duplicates against existing hashes, then insert in chunks.
    const { data: existingRows, error: hashErr } = await supabase
      .from("transactions")
      .select("content_hash")
      .in(
        "content_hash",
        Array.from(new Set(inputs.map((i) => i.contentHash))),
      );
    if (hashErr)
      throw new Error(`Could not check for duplicates: ${hashErr.message}`);
    const existing = new Set(
      (existingRows as { content_hash: string }[]).map((r) => r.content_hash),
    );

    const fresh = inputs.filter((i) => !existing.has(i.contentHash));
    let inserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < fresh.length; i += chunkSize) {
      const chunk = fresh
        .slice(i, i + chunkSize)
        .map((input) => SupabaseProvider.toDb(input, user.id));
      const { error } = await supabase.from("transactions").insert(chunk);
      if (error)
        throw new Error(`Import failed: ${error.message}`);
      inserted += chunk.length;
    }
    return inserted;
  }

  async listCategories(): Promise<Category[]> {
    const { data, error } = await createClient()
      .from("expense_categories")
      .select("id, name, is_system")
      .order("is_system")
      .order("sort_order");
    if (error) throw new Error(`Could not load categories: ${error.message}`);
    return (data as unknown as { id: string; name: string; is_system: boolean }[]).map(
      (c) => ({ id: c.id, name: c.name, isSystem: c.is_system }),
    );
  }

  async createCategory(name: string): Promise<Category> {
    const { data, error } = await createClient()
      .from("expense_categories")
      .insert({ name: name.trim(), is_system: false })
      .select("id, name, is_system")
      .single();
    if (error) throw new Error(`Could not create category: ${error.message}`);
    return { id: data.id, name: data.name, isSystem: data.is_system };
  }

  async listBudgets(): Promise<Budget[]> {
    const { data, error } = await createClient()
      .from("budgets")
      .select(
        "id, name, category_id, amount::text, period_start, period_end, expense_categories(name)",
      )
      .order("period_start", { ascending: false });
    if (error) throw new Error(`Could not load budgets: ${error.message}`);
    return (data as unknown as DbBudget[]).map((b) => ({
      id: b.id,
      name: b.name,
      categoryId: b.category_id,
      categoryName: b.expense_categories?.name ?? null,
      amountPaise: toPaise(b.amount),
      periodStart: b.period_start,
      periodEnd: b.period_end,
    }));
  }

  async createBudget(input: BudgetInput): Promise<Budget> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("budgets")
      .insert({
        user_id: user.id,
        name: input.name,
        category_id: input.categoryId,
        amount: paiseToStoredString(input.amountPaise),
        period_start: input.periodStart,
        period_end: input.periodEnd,
      })
      .select(
        "id, name, category_id, amount::text, period_start, period_end, expense_categories(name)",
      )
      .single();
    if (error) throw new Error(`Could not save budget: ${error.message}`);
    const b = data as unknown as DbBudget;
    return {
      id: b.id,
      name: b.name,
      categoryId: b.category_id,
      categoryName: b.expense_categories?.name ?? null,
      amountPaise: toPaise(b.amount),
      periodStart: b.period_start,
      periodEnd: b.period_end,
    };
  }

  async updateBudget(id: string, patch: Partial<BudgetInput>): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.categoryId !== undefined) update.category_id = patch.categoryId;
    if (patch.amountPaise !== undefined)
      update.amount = paiseToStoredString(patch.amountPaise);
    if (patch.periodStart !== undefined) update.period_start = patch.periodStart;
    if (patch.periodEnd !== undefined) update.period_end = patch.periodEnd;
    const { error } = await createClient()
      .from("budgets")
      .update(update)
      .eq("id", id);
    if (error) throw new Error(`Could not update budget: ${error.message}`);
  }

  async deleteBudget(id: string): Promise<void> {
    const { error } = await createClient().from("budgets").delete().eq("id", id);
    if (error) throw new Error(`Could not delete budget: ${error.message}`);
  }

  async listSavingsGoals(): Promise<SavingsGoal[]> {
    const { data, error } = await createClient()
      .from("savings_goals")
      .select("id, name, kind, target_amount::text, current_amount::text, target_date")
      .order("created_at");
    if (error) throw new Error(`Could not load savings goals: ${error.message}`);
    return (data as unknown as DbGoal[]).map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      targetAmountPaise: toPaise(g.target_amount),
      currentAmountPaise: toPaise(g.current_amount),
      targetDate: g.target_date,
    }));
  }

  async createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("savings_goals")
      .insert({
        user_id: user.id,
        name: input.name,
        kind: input.kind,
        target_amount: paiseToStoredString(input.targetAmountPaise),
        current_amount: paiseToStoredString(input.currentAmountPaise),
        target_date: input.targetDate,
      })
      .select("id, name, kind, target_amount::text, current_amount::text, target_date")
      .single();
    if (error) throw new Error(`Could not save goal: ${error.message}`);
    const g = data as unknown as DbGoal;
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      targetAmountPaise: toPaise(g.target_amount),
      currentAmountPaise: toPaise(g.current_amount),
      targetDate: g.target_date,
    };
  }

  async updateSavingsGoal(
    id: string,
    patch: Partial<SavingsGoalInput>,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.kind !== undefined) update.kind = patch.kind;
    if (patch.targetAmountPaise !== undefined)
      update.target_amount = paiseToStoredString(patch.targetAmountPaise);
    if (patch.currentAmountPaise !== undefined)
      update.current_amount = paiseToStoredString(patch.currentAmountPaise);
    if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
    const { error } = await createClient()
      .from("savings_goals")
      .update(update)
      .eq("id", id);
    if (error) throw new Error(`Could not update goal: ${error.message}`);
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    const { error } = await createClient()
      .from("savings_goals")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Could not delete goal: ${error.message}`);
  }
}
