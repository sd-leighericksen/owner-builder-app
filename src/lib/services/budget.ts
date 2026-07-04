import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { budgetCategories, transactions, variations, quotes } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import { resolveMoney } from "./util";
import { writeAudit } from "./audit";
import { emitWebhookEvent } from "./webhooks";
import { computeBudgetSummary, type BudgetSummary } from "./budget-math";
import type {
  budgetCategoryCreate,
  budgetCategoryUpdate,
  transactionCreate,
  transactionUpdate,
  variationCreate,
  variationUpdate,
} from "@/lib/validation/schemas";

const BUDGET_ALERT_THRESHOLD = 0.9; // brief: alert at 90% consumed

// --- Categories -------------------------------------------------------------

export async function listCategories(accountId: string, projectId: string) {
  const db = await getDb();
  return db
    .select()
    .from(budgetCategories)
    .where(and(eq(budgetCategories.projectId, projectId), eq(budgetCategories.accountId, accountId), isNull(budgetCategories.deletedAt)))
    .orderBy(asc(budgetCategories.sortOrder), asc(budgetCategories.code));
}

export async function createCategory(accountId: string, userId: string, input: z.infer<typeof budgetCategoryCreate>) {
  const db = await getDb();
  const id = newId();
  await db.insert(budgetCategories).values({ id, accountId, createdBy: userId, ...input });
  return (await db.select().from(budgetCategories).where(eq(budgetCategories.id, id)))[0];
}

export async function updateCategory(accountId: string, categoryId: string, input: z.infer<typeof budgetCategoryUpdate>) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(budgetCategories)
    .where(and(eq(budgetCategories.id, categoryId), eq(budgetCategories.accountId, accountId), isNull(budgetCategories.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Budget category not found");
  await db
    .update(budgetCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(budgetCategories.id, categoryId));
  return (await db.select().from(budgetCategories).where(eq(budgetCategories.id, categoryId)))[0];
}

// --- Transactions -----------------------------------------------------------

export async function listTransactions(accountId: string, projectId: string) {
  const db = await getDb();
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.projectId, projectId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.transactionDate), desc(transactions.id));
}

export async function createTransaction(accountId: string, userId: string, input: z.infer<typeof transactionCreate>) {
  const db = await getDb();
  const { money, ...fields } = input;
  const resolved = resolveMoney(money);
  const id = newId();
  await db.insert(transactions).values({ id, accountId, createdBy: userId, ...fields, ...resolved });
  const row = (await db.select().from(transactions).where(eq(transactions.id, id)))[0];
  await writeAudit({ accountId, actorUserId: userId, tableName: "transactions", recordId: id, action: "insert", newValues: row });
  await maybeEmitBudgetThreshold(accountId, input.projectId, input.budgetCategoryId ?? null);
  return row;
}

export async function updateTransaction(accountId: string, userId: string, transactionId: string, input: z.infer<typeof transactionUpdate>) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt)));
  const existing = rows[0];
  if (!existing) throw new NotFoundError("Transaction not found");
  const { money, ...fields } = input;
  const resolved = money ? resolveMoney(money) : {};
  await db
    .update(transactions)
    .set({ ...fields, ...resolved, updatedAt: new Date() })
    .where(eq(transactions.id, transactionId));
  const updated = (await db.select().from(transactions).where(eq(transactions.id, transactionId)))[0];
  await writeAudit({
    accountId, actorUserId: userId, tableName: "transactions", recordId: transactionId,
    action: "update", oldValues: existing, newValues: updated,
  });
  return updated;
}

export async function softDeleteTransaction(accountId: string, userId: string, transactionId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Transaction not found");
  await db.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, transactionId));
  await writeAudit({
    accountId, actorUserId: userId, tableName: "transactions", recordId: transactionId,
    action: "soft_delete", oldValues: rows[0],
  });
}

// --- Variations ---------------------------------------------------------------

export async function listVariations(accountId: string, projectId: string) {
  const db = await getDb();
  return db
    .select()
    .from(variations)
    .where(and(eq(variations.projectId, projectId), eq(variations.accountId, accountId), isNull(variations.deletedAt)))
    .orderBy(desc(variations.createdAt));
}

export async function createVariation(accountId: string, userId: string, input: z.infer<typeof variationCreate>) {
  const db = await getDb();
  const { money, ...fields } = input;
  const resolved = resolveMoney(money);
  const id = newId();
  await db.insert(variations).values({ id, accountId, createdBy: userId, ...fields, ...resolved });
  const row = (await db.select().from(variations).where(eq(variations.id, id)))[0];
  await writeAudit({ accountId, actorUserId: userId, tableName: "variations", recordId: id, action: "insert", newValues: row });
  return row;
}

export async function updateVariation(accountId: string, userId: string, variationId: string, input: z.infer<typeof variationUpdate>) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(variations)
    .where(and(eq(variations.id, variationId), eq(variations.accountId, accountId), isNull(variations.deletedAt)));
  const existing = rows[0];
  if (!existing) throw new NotFoundError("Variation not found");
  const { money, ...fields } = input;
  const resolved = money ? resolveMoney(money) : {};
  await db
    .update(variations)
    .set({ ...fields, ...resolved, updatedAt: new Date() })
    .where(eq(variations.id, variationId));
  const updated = (await db.select().from(variations).where(eq(variations.id, variationId)))[0];
  await writeAudit({
    accountId, actorUserId: userId, tableName: "variations", recordId: variationId,
    action: "update", oldValues: existing, newValues: updated,
  });
  return updated;
}

// --- Summary ---------------------------------------------------------------------

export async function getBudgetSummary(accountId: string, projectId: string): Promise<BudgetSummary> {
  const db = await getDb();
  const [cats, txns, qts, vars] = await Promise.all([
    listCategories(accountId, projectId),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt))),
    db
      .select()
      .from(quotes)
      .where(and(eq(quotes.projectId, projectId), eq(quotes.accountId, accountId), isNull(quotes.deletedAt))),
    db
      .select()
      .from(variations)
      .where(and(eq(variations.projectId, projectId), eq(variations.accountId, accountId), isNull(variations.deletedAt))),
  ]);
  return computeBudgetSummary(cats, txns, qts, vars);
}

/** Emit budget.threshold when a category crosses 90% consumed (brief §7.4). */
async function maybeEmitBudgetThreshold(accountId: string, projectId: string, categoryId: string | null) {
  if (!categoryId) return;
  try {
    const summary = await getBudgetSummary(accountId, projectId);
    const cat = summary.categories.find((c) => c.id === categoryId);
    if (cat?.percentConsumed != null && cat.percentConsumed >= BUDGET_ALERT_THRESHOLD) {
      await emitWebhookEvent(accountId, "budget.threshold", {
        projectId,
        budgetCategoryId: categoryId,
        code: cat.code,
        name: cat.name,
        percentConsumed: Math.round(cat.percentConsumed * 100),
        budgetIncGst: cat.budgetIncGst,
        actualIncGst: cat.actualIncGst,
      });
    }
  } catch (err) {
    console.error("budget threshold check failed", err);
  }
}
