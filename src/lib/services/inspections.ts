import { and, asc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { inspections } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import { writeAudit } from "./audit";
import type { inspectionCreate, inspectionUpdate } from "@/lib/validation/schemas";

export async function listInspections(accountId: string, projectId: string) {
  const db = await getDb();
  return db
    .select()
    .from(inspections)
    .where(and(eq(inspections.projectId, projectId), eq(inspections.accountId, accountId), isNull(inspections.deletedAt)))
    .orderBy(asc(inspections.bookedDate), asc(inspections.id));
}

export async function createInspection(accountId: string, userId: string, input: z.infer<typeof inspectionCreate>) {
  const db = await getDb();
  const id = newId();
  await db.insert(inspections).values({ id, accountId, createdBy: userId, ...input });
  const row = (await db.select().from(inspections).where(eq(inspections.id, id)))[0];
  await writeAudit({ accountId, actorUserId: userId, tableName: "inspections", recordId: id, action: "insert", newValues: row });
  return row;
}

export async function updateInspection(accountId: string, userId: string, inspectionId: string, input: z.infer<typeof inspectionUpdate>) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(inspections)
    .where(and(eq(inspections.id, inspectionId), eq(inspections.accountId, accountId), isNull(inspections.deletedAt)));
  const existing = rows[0];
  if (!existing) throw new NotFoundError("Inspection not found");
  await db
    .update(inspections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(inspections.id, inspectionId));
  const updated = (await db.select().from(inspections).where(eq(inspections.id, inspectionId)))[0];
  await writeAudit({
    accountId, actorUserId: userId, tableName: "inspections", recordId: inspectionId,
    action: "update", oldValues: existing, newValues: updated,
  });
  return updated;
}
