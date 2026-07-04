import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { quotes, quoteLineItems, contacts } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import { resolveMoney } from "./util";
import { sumMoney } from "@/lib/money";
import type { quoteCreate, quoteUpdate } from "@/lib/validation/schemas";

export async function listQuotes(accountId: string, projectId: string, budgetCategoryId?: string) {
  const db = await getDb();
  const conditions = [
    eq(quotes.projectId, projectId),
    eq(quotes.accountId, accountId),
    isNull(quotes.deletedAt),
  ];
  if (budgetCategoryId) conditions.push(eq(quotes.budgetCategoryId, budgetCategoryId));
  const rows = await db
    .select()
    .from(quotes)
    .where(and(...conditions))
    .orderBy(desc(quotes.createdAt));

  const contactRows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.accountId, accountId));
  const contactById = new Map(contactRows.map((c) => [c.id, c]));
  return rows.map((q) => ({
    ...q,
    contactName: contactById.get(q.contactId)?.businessName ?? "Unknown",
  }));
}

export async function getQuote(accountId: string, quoteId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.accountId, accountId), isNull(quotes.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Quote not found");
  const lineItems = await db
    .select()
    .from(quoteLineItems)
    .where(and(eq(quoteLineItems.quoteId, quoteId), isNull(quoteLineItems.deletedAt)))
    .orderBy(asc(quoteLineItems.sortOrder));
  return { ...rows[0], lineItems };
}

export async function createQuote(accountId: string, userId: string, input: z.infer<typeof quoteCreate>) {
  const db = await getDb();
  const { money, lineItems, ...fields } = input;

  // Quote total: explicit money wins; otherwise derived from line items.
  const itemMoney = lineItems.map((li) => resolveMoney(li.money));
  const resolved = money
    ? resolveMoney(money)
    : lineItems.length > 0
      ? { ...sumMoney(itemMoney), gstApplicable: itemMoney.some((m) => m.gstApplicable) }
      : { amountExGst: 0, gstAmount: 0, gstApplicable: true };

  const id = newId();
  await db.insert(quotes).values({ id, accountId, createdBy: userId, ...fields, ...resolved });
  if (lineItems.length > 0) {
    await db.insert(quoteLineItems).values(
      lineItems.map((li, i) => ({
        id: newId(),
        accountId,
        createdBy: userId,
        quoteId: id,
        description: li.description,
        qty: li.qty,
        unit: li.unit,
        unitPriceCents: li.unitPriceCents,
        ...itemMoney[i],
        sortOrder: i,
      })),
    );
  }
  return getQuote(accountId, id);
}

export async function updateQuote(accountId: string, quoteId: string, input: z.infer<typeof quoteUpdate>) {
  const db = await getDb();
  await getQuote(accountId, quoteId);
  const { money, ...fields } = input;
  const resolved = money ? resolveMoney(money) : {};
  await db
    .update(quotes)
    .set({ ...fields, ...resolved, updatedAt: new Date() })
    .where(and(eq(quotes.id, quoteId), eq(quotes.accountId, accountId)));
  return getQuote(accountId, quoteId);
}

export async function softDeleteQuote(accountId: string, quoteId: string) {
  const db = await getDb();
  await getQuote(accountId, quoteId);
  await db
    .update(quotes)
    .set({ deletedAt: new Date() })
    .where(and(eq(quotes.id, quoteId), eq(quotes.accountId, accountId)));
}

/**
 * Side-by-side comparison: all quotes for a budget category (the "scope"),
 * with line items, ordered cheapest first (brief §5 Phase 1.4).
 */
export async function compareQuotes(accountId: string, projectId: string, budgetCategoryId: string) {
  const list = await listQuotes(accountId, projectId, budgetCategoryId);
  const detailed = await Promise.all(list.map((q) => getQuote(accountId, q.id)));
  const byId = new Map(list.map((q) => [q.id, q]));
  return detailed
    .map((q) => ({ ...q, contactName: byId.get(q.id)?.contactName ?? "Unknown" }))
    .sort((a, b) => a.amountExGst + a.gstAmount - (b.amountExGst + b.gstAmount));
}
