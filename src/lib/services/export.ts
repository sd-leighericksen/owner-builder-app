import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  projects, stages, tasks, taskDependencies, contacts, contactInsurances,
  quotes, quoteLineItems, budgetCategories, transactions, variations,
  documents, inspections, diaryEntries, photos,
} from "@/db/schema";
import { getProject } from "./projects";

/**
 * Full project export as JSON (brief §7.3 — "the user's data must never be
 * trapped"). Includes storage paths so files can be fetched separately;
 * available from Settings from Phase 1.
 */
export async function exportProject(accountId: string, projectId: string) {
  const db = await getDb();
  const project = await getProject(accountId, projectId);

  const [
    stageRows, taskRows, contactRows, insuranceRows, quoteRows, lineItemRows,
    categoryRows, transactionRows, variationRows, documentRows, inspectionRows,
    diaryRows, photoRows,
  ] = await Promise.all([
    db.select().from(stages).where(and(eq(stages.projectId, projectId), eq(stages.accountId, accountId), isNull(stages.deletedAt))),
    db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.accountId, accountId), isNull(tasks.deletedAt))),
    db.select().from(contacts).where(and(eq(contacts.accountId, accountId), isNull(contacts.deletedAt))),
    db.select().from(contactInsurances).where(and(eq(contactInsurances.accountId, accountId), isNull(contactInsurances.deletedAt))),
    db.select().from(quotes).where(and(eq(quotes.projectId, projectId), eq(quotes.accountId, accountId), isNull(quotes.deletedAt))),
    db.select().from(quoteLineItems).where(and(eq(quoteLineItems.accountId, accountId), isNull(quoteLineItems.deletedAt))),
    db.select().from(budgetCategories).where(and(eq(budgetCategories.projectId, projectId), eq(budgetCategories.accountId, accountId), isNull(budgetCategories.deletedAt))),
    db.select().from(transactions).where(and(eq(transactions.projectId, projectId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt))),
    db.select().from(variations).where(and(eq(variations.projectId, projectId), eq(variations.accountId, accountId), isNull(variations.deletedAt))),
    db.select().from(documents).where(and(eq(documents.projectId, projectId), eq(documents.accountId, accountId), isNull(documents.deletedAt))),
    db.select().from(inspections).where(and(eq(inspections.projectId, projectId), eq(inspections.accountId, accountId), isNull(inspections.deletedAt))),
    db.select().from(diaryEntries).where(and(eq(diaryEntries.projectId, projectId), eq(diaryEntries.accountId, accountId), isNull(diaryEntries.deletedAt))),
    db.select().from(photos).where(and(eq(photos.projectId, projectId), eq(photos.accountId, accountId), isNull(photos.deletedAt))),
  ]);

  const taskIds = new Set(taskRows.map((t) => t.id));
  const depRows = (await db.select().from(taskDependencies)).filter((d) => taskIds.has(d.taskId));
  const quoteIds = new Set(quoteRows.map((q) => q.id));

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    project,
    stages: stageRows,
    tasks: taskRows,
    taskDependencies: depRows,
    contacts: contactRows,
    contactInsurances: insuranceRows,
    quotes: quoteRows,
    quoteLineItems: lineItemRows.filter((li) => quoteIds.has(li.quoteId)),
    budgetCategories: categoryRows,
    transactions: transactionRows,
    variations: variationRows,
    documents: documentRows,
    inspections: inspectionRows,
    diaryEntries: diaryRows,
    photos: photoRows,
  };
}
