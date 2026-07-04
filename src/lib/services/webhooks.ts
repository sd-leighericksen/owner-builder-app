import { createHmac } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEndpoints, webhookEvents } from "@/db/schema";
import { newId } from "@/lib/ids";

export type WebhookEventType =
  | "task.due"
  | "inspection.due"
  | "insurance.expiring"
  | "budget.threshold"
  | "document.added";

/**
 * Record an outbound event. Delivery happens asynchronously via the cron
 * route (/api/v1/jobs/run) so request handling never waits on n8n.
 */
export async function emitWebhookEvent(
  accountId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(webhookEvents).values({
    id: newId(),
    accountId,
    eventType,
    payload: { type: eventType, occurredAt: new Date().toISOString(), data: payload },
  });
}

export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const MAX_ATTEMPTS = 5;

/** Deliver undelivered events to all active matching endpoints. Called by cron. */
export async function deliverPendingWebhooks(): Promise<{ delivered: number; failed: number }> {
  const db = await getDb();
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? "";
  const pending = await db
    .select()
    .from(webhookEvents)
    .where(and(isNull(webhookEvents.deliveredAt), lt(webhookEvents.attempts, MAX_ATTEMPTS)))
    .limit(50);

  let delivered = 0;
  let failed = 0;
  for (const event of pending) {
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.accountId, event.accountId), eq(webhookEndpoints.active, true)));
    const targets = endpoints.filter(
      (e) => e.eventTypes.length === 0 || e.eventTypes.includes(event.eventType),
    );

    if (targets.length === 0) {
      // Nothing subscribed — mark delivered so the queue doesn't grow forever.
      await db.update(webhookEvents).set({ deliveredAt: new Date() }).where(eq(webhookEvents.id, event.id));
      continue;
    }

    const body = JSON.stringify(event.payload);
    const signature = signPayload(body, secret);
    let allOk = true;
    for (const target of targets) {
      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-OB-Signature": `sha256=${signature}`,
            "X-OB-Event": event.eventType,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) allOk = false;
      } catch {
        allOk = false;
      }
    }

    if (allOk) {
      await db.update(webhookEvents).set({ deliveredAt: new Date() }).where(eq(webhookEvents.id, event.id));
      delivered++;
    } else {
      await db
        .update(webhookEvents)
        .set({ attempts: event.attempts + 1, lastError: "one or more endpoints failed" })
        .where(eq(webhookEvents.id, event.id));
      failed++;
    }
  }
  return { delivered, failed };
}
