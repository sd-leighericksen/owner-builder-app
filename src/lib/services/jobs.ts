import { and, eq, gte, isNull, isNotNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks, inspections, contactInsurances, contacts, webhookEvents, accounts } from "@/db/schema";
import { emitWebhookEvent, deliverPendingWebhooks, type WebhookEventType } from "./webhooks";
import { todayISO } from "@/lib/dates";

const DUE_SOON_DAYS = 3;
const INSURANCE_WARNING_DAYS = 30;
const DEDUPE_WINDOW_DAYS = 7;

/**
 * DB-backed job sweep, invoked by the cron route (brief §3 jobs/notifications).
 * Produces webhook events (task.due, inspection.due, insurance.expiring) for
 * n8n to turn into email/SMS/Slack, then delivers pending events.
 */
export async function runJobs() {
  const db = await getDb();
  const accountRows = await db.select().from(accounts).where(isNull(accounts.deletedAt));
  let emitted = 0;
  for (const account of accountRows) {
    emitted += await sweepAccount(account.id);
  }
  const delivery = await deliverPendingWebhooks();
  return { accounts: accountRows.length, eventsEmitted: emitted, ...delivery };
}

async function sweepAccount(accountId: string): Promise<number> {
  const db = await getDb();
  const today = todayISO();
  const dueHorizon = addDaysISO(today, DUE_SOON_DAYS);
  const insuranceHorizon = addDaysISO(today, INSURANCE_WARNING_DAYS);
  let emitted = 0;

  // Dedupe: skip records we've already emitted this event type for recently.
  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000);
  const recent = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.accountId, accountId), gte(webhookEvents.createdAt, since)));
  const seen = new Set(
    recent.map((e) => {
      const data = (e.payload as { data?: { recordId?: string } })?.data;
      return `${e.eventType}:${data?.recordId ?? ""}`;
    }),
  );

  const emit = async (type: WebhookEventType, recordId: string, payload: Record<string, unknown>) => {
    if (seen.has(`${type}:${recordId}`)) return;
    await emitWebhookEvent(accountId, type, { recordId, ...payload });
    emitted++;
  };

  const dueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.accountId, accountId),
        isNull(tasks.deletedAt),
        ne(tasks.status, "done"),
        isNotNull(tasks.dueDate),
        lte(tasks.dueDate, dueHorizon),
      ),
    );
  for (const t of dueTasks) {
    await emit("task.due", t.id, { projectId: t.projectId, title: t.title, dueDate: t.dueDate });
  }

  const dueInspections = await db
    .select()
    .from(inspections)
    .where(
      and(
        eq(inspections.accountId, accountId),
        isNull(inspections.deletedAt),
        isNull(inspections.completedDate),
        isNotNull(inspections.bookedDate),
        lte(inspections.bookedDate, dueHorizon),
      ),
    );
  for (const i of dueInspections) {
    await emit("inspection.due", i.id, { projectId: i.projectId, type: i.type, bookedDate: i.bookedDate });
  }

  const expiringInsurances = await db
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
        lte(contactInsurances.expiryDate, insuranceHorizon),
      ),
    );
  for (const i of expiringInsurances) {
    await emit("insurance.expiring", i.id, {
      contact: i.businessName,
      insuranceType: i.type,
      expiryDate: i.expiryDate,
    });
  }

  return emitted;
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
