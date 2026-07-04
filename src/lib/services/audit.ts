import { getDb } from "@/db";
import { auditLog } from "@/db/schema";
import { newId } from "@/lib/ids";

/**
 * Append-only audit trail for key tables (brief §7.2): transactions,
 * variations, inspections, documents. Never blocks the main operation.
 */
export async function writeAudit(args: {
  accountId: string;
  actorUserId: string | null;
  tableName: string;
  recordId: string;
  action: "insert" | "update" | "soft_delete";
  oldValues?: unknown;
  newValues?: unknown;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      id: newId(),
      accountId: args.accountId,
      actorUserId: args.actorUserId,
      tableName: args.tableName,
      recordId: args.recordId,
      action: args.action,
      oldValues: args.oldValues ?? null,
      newValues: args.newValues ?? null,
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
