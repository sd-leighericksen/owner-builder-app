/**
 * Pure budget arithmetic — no DB access, fully unit-tested.
 * Definitions (brief §5 Phase 1.3):
 * - budget:    category budget_amount (inc GST, cents)
 * - committed: accepted quotes + approved variations for the category
 * - actual:    transactions for the category (refunds subtract)
 * - contingency burn: approved variation cost increases consume contingency
 */

export interface MoneyRow {
  amountExGst: number;
  gstAmount: number;
}

export interface CategoryInput {
  id: string;
  code: string;
  name: string;
  budgetAmount: number; // cents inc GST
  isContingency: boolean;
}

export interface TransactionInput extends MoneyRow {
  budgetCategoryId: string | null;
  type: "invoice" | "receipt" | "deposit" | "refund";
}

export interface QuoteInput extends MoneyRow {
  budgetCategoryId: string | null;
  status: "requested" | "received" | "accepted" | "declined";
}

export interface VariationInput extends MoneyRow {
  budgetCategoryId: string | null;
  status: "proposed" | "approved" | "rejected";
}

export interface CategorySummary {
  id: string;
  code: string;
  name: string;
  isContingency: boolean;
  budgetIncGst: number;
  committedExGst: number;
  committedGst: number;
  committedIncGst: number;
  actualExGst: number;
  actualGst: number;
  actualIncGst: number;
  remainingVsBudget: number; // budget - actual (inc GST)
  percentConsumed: number | null; // actual/budget, null when budget is 0
}

export interface BudgetSummary {
  categories: CategorySummary[];
  totals: {
    budgetIncGst: number;
    committedIncGst: number;
    actualIncGst: number;
    actualExGst: number;
    actualGst: number;
    remainingVsBudget: number;
  };
  contingency: {
    budgetIncGst: number;
    consumedByVariationsIncGst: number; // approved cost increases
    remainingIncGst: number;
  };
  gst: {
    paidGst: number; // GST component of all actuals
    committedGst: number;
  };
}

/** Signed inc-GST value of a transaction: refunds subtract. */
export function transactionSign(type: TransactionInput["type"]): 1 | -1 {
  return type === "refund" ? -1 : 1;
}

export function computeBudgetSummary(
  categories: CategoryInput[],
  transactions: TransactionInput[],
  quotes: QuoteInput[],
  variations: VariationInput[],
): BudgetSummary {
  const byCategory = new Map<string, CategorySummary>();
  for (const c of categories) {
    byCategory.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      isContingency: c.isContingency,
      budgetIncGst: c.budgetAmount,
      committedExGst: 0,
      committedGst: 0,
      committedIncGst: 0,
      actualExGst: 0,
      actualGst: 0,
      actualIncGst: 0,
      remainingVsBudget: c.budgetAmount,
      percentConsumed: c.budgetAmount === 0 ? null : 0,
    });
  }

  for (const t of transactions) {
    const cat = t.budgetCategoryId ? byCategory.get(t.budgetCategoryId) : undefined;
    const sign = transactionSign(t.type);
    if (cat) {
      cat.actualExGst += sign * t.amountExGst;
      cat.actualGst += sign * t.gstAmount;
    }
  }

  for (const q of quotes) {
    if (q.status !== "accepted") continue;
    const cat = q.budgetCategoryId ? byCategory.get(q.budgetCategoryId) : undefined;
    if (cat) {
      cat.committedExGst += q.amountExGst;
      cat.committedGst += q.gstAmount;
    }
  }

  let contingencyConsumed = 0;
  for (const v of variations) {
    if (v.status !== "approved") continue;
    const cat = v.budgetCategoryId ? byCategory.get(v.budgetCategoryId) : undefined;
    if (cat) {
      cat.committedExGst += v.amountExGst;
      cat.committedGst += v.gstAmount;
    }
    // Only cost increases burn contingency; savings don't refill it.
    const incGst = v.amountExGst + v.gstAmount;
    if (incGst > 0) contingencyConsumed += incGst;
  }

  const summaries = [...byCategory.values()];
  for (const cat of summaries) {
    cat.committedIncGst = cat.committedExGst + cat.committedGst;
    cat.actualIncGst = cat.actualExGst + cat.actualGst;
    cat.remainingVsBudget = cat.budgetIncGst - cat.actualIncGst;
    cat.percentConsumed = cat.budgetIncGst === 0 ? null : cat.actualIncGst / cat.budgetIncGst;
  }

  const totals = summaries.reduce(
    (acc, c) => ({
      budgetIncGst: acc.budgetIncGst + c.budgetIncGst,
      committedIncGst: acc.committedIncGst + c.committedIncGst,
      actualIncGst: acc.actualIncGst + c.actualIncGst,
      actualExGst: acc.actualExGst + c.actualExGst,
      actualGst: acc.actualGst + c.actualGst,
      remainingVsBudget: acc.remainingVsBudget + c.remainingVsBudget,
    }),
    { budgetIncGst: 0, committedIncGst: 0, actualIncGst: 0, actualExGst: 0, actualGst: 0, remainingVsBudget: 0 },
  );

  const contingencyBudget = summaries
    .filter((c) => c.isContingency)
    .reduce((sum, c) => sum + c.budgetIncGst, 0);

  return {
    categories: summaries,
    totals,
    contingency: {
      budgetIncGst: contingencyBudget,
      consumedByVariationsIncGst: contingencyConsumed,
      remainingIncGst: contingencyBudget - contingencyConsumed,
    },
    gst: {
      paidGst: totals.actualGst,
      committedGst: summaries.reduce((sum, c) => sum + c.committedGst, 0),
    },
  };
}
