import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { getDb } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { newId } from "@/lib/ids";

const endpointCreate = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string()).default([]), // empty = all events
});

export const GET = apiHandler(async ({ auth }) => {
  const db = await getDb();
  const items = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.accountId, auth.accountId), isNull(webhookEndpoints.deletedAt)))
    .orderBy(asc(webhookEndpoints.createdAt));
  return json({ items });
});

export const POST = apiHandler(async ({ request, auth }) => {
  const input = await parseBody(request, endpointCreate);
  const db = await getDb();
  const id = newId();
  await db.insert(webhookEndpoints).values({ id, accountId: auth.accountId, createdBy: auth.userId, ...input });
  const row = (await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)))[0];
  return json(row, { status: 201 });
});
