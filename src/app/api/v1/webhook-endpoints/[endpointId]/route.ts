import { and, eq, isNull } from "drizzle-orm";
import { apiHandler, json, NotFoundError } from "@/lib/api/handler";
import { getDb } from "@/db";
import { webhookEndpoints } from "@/db/schema";

export const DELETE = apiHandler<{ endpointId: string }>(async ({ auth, params }) => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, params.endpointId), eq(webhookEndpoints.accountId, auth.accountId), isNull(webhookEndpoints.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Webhook endpoint not found");
  await db.update(webhookEndpoints).set({ deletedAt: new Date() }).where(eq(webhookEndpoints.id, params.endpointId));
  return json({ ok: true });
});
