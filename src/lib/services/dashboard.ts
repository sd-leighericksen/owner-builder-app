import { and, asc, eq, isNull, isNotNull, gte, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { stages, tasks, inspections, documents, contactInsurances, contacts, quotes } from "@/db/schema";
import { getBudgetSummary } from "./budget";
import { todayISO, daysUntil } from "@/lib/dates";

const EXPIRY_HORIZON_DAYS = 60;

export interface ExpiringItem {
  kind: "document" | "contact_insurance" | "contact_licence" | "quote_validity";
  id: string;
  label: string;
  expiryDate: string;
  daysRemaining: number;
}

/**
 * Dashboard aggregate (brief §5 Phase 1.7): current stage, next tasks,
 * upcoming inspections, budget position, expiring items.
 */
export async function getDashboard(accountId: string, projectId: string) {
  const db = await getDb();
  const today = todayISO();

  const [stageRows, taskRows, inspectionRows, budget] = await Promise.all([
    db
      .select()
      .from(stages)
      .where(and(eq(stages.projectId, projectId), eq(stages.accountId, accountId), isNull(stages.deletedAt)))
      .orderBy(asc(stages.sequence)),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.accountId, accountId),
          isNull(tasks.deletedAt),
          ne(tasks.status, "done"),
        ),
      )
      .orderBy(asc(tasks.dueDate))
      .limit(200),
    db
      .select()
      .from(inspections)
      .where(and(eq(inspections.projectId, projectId), eq(inspections.accountId, accountId), isNull(inspections.deletedAt))),
    getBudgetSummary(accountId, projectId),
  ]);

  const currentStage =
    stageRows.find((s) => s.status === "in_progress") ??
    stageRows.find((s) => s.status === "not_started") ??
    null;

  const nextTasks = taskRows
    .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1)
    .slice(0, 8);

  const upcomingInspections = inspectionRows
    .filter((i) => !i.completedDate)
    .sort((a, b) => ((a.bookedDate ?? "9999") < (b.bookedDate ?? "9999") ? -1 : 1))
    .slice(0, 8);

  const expiring = await getExpiringItems(accountId, projectId);

  const overdueTasks = taskRows.filter((t) => t.dueDate && t.dueDate < today).length;

  return {
    currentStage,
    stages: stageRows,
    nextTasks,
    overdueTasks,
    upcomingInspections,
    budget,
    expiring,
  };
}

export async function getExpiringItems(accountId: string, projectId?: string): Promise<ExpiringItem[]> {
  const db = await getDb();
  const today = todayISO();
  const horizon = addDaysISO(today, EXPIRY_HORIZON_DAYS);
  const items: ExpiringItem[] = [];

  const docConditions = [
    eq(documents.accountId, accountId),
    isNull(documents.deletedAt),
    isNotNull(documents.expiryDate),
    lte(documents.expiryDate, horizon),
  ];
  if (projectId) docConditions.push(eq(documents.projectId, projectId));
  const docs = await db.select().from(documents).where(and(...docConditions));
  for (const d of docs) {
    items.push({
      kind: "document",
      id: d.id,
      label: `${d.title} (${d.category.replace(/_/g, " ")})`,
      expiryDate: d.expiryDate!,
      daysRemaining: daysUntil(d.expiryDate!),
    });
  }

  const insurances = await db
    .select({
      id: contactInsurances.id,
      type: contactInsurances.type,
      expiryDate: contactInsurances.expiryDate,
      businessName: contacts.businessName,
    })
    .from(contactInsurances)
    .innerJoin(contacts, eq(contactInsurances.contactId, contacts.id))
    .where(
      and(
        eq(contactInsurances.accountId, accountId),
        isNull(contactInsurances.deletedAt),
        isNotNull(contactInsurances.expiryDate),
        lte(contactInsurances.expiryDate, horizon),
      ),
    );
  for (const i of insurances) {
    items.push({
      kind: "contact_insurance",
      id: i.id,
      label: `${i.businessName} — ${i.type.replace(/_/g, " ")} insurance`,
      expiryDate: i.expiryDate!,
      daysRemaining: daysUntil(i.expiryDate!),
    });
  }

  const licences = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        isNull(contacts.deletedAt),
        isNotNull(contacts.licenceExpiry),
        lte(contacts.licenceExpiry, horizon),
      ),
    );
  for (const c of licences) {
    items.push({
      kind: "contact_licence",
      id: c.id,
      label: `${c.businessName} — licence ${c.licenceNumber ?? ""}`.trim(),
      expiryDate: c.licenceExpiry!,
      daysRemaining: daysUntil(c.licenceExpiry!),
    });
  }

  const quoteConditions = [
    eq(quotes.accountId, accountId),
    isNull(quotes.deletedAt),
    isNotNull(quotes.validUntil),
    lte(quotes.validUntil, horizon),
    gte(quotes.validUntil, today),
    eq(quotes.status, "received"),
  ];
  if (projectId) quoteConditions.push(eq(quotes.projectId, projectId));
  const expiringQuotes = await db.select().from(quotes).where(and(...quoteConditions));
  for (const q of expiringQuotes) {
    items.push({
      kind: "quote_validity",
      id: q.id,
      label: `Quote expiring: ${q.scopeOfWork?.slice(0, 60) ?? q.id.slice(0, 8)}`,
      expiryDate: q.validUntil!,
      daysRemaining: daysUntil(q.validUntil!),
    });
  }

  return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
