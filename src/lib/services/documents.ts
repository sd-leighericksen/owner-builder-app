import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import { writeAudit } from "./audit";
import { emitWebhookEvent } from "./webhooks";
import { putFile, getSignedUrl } from "./storage";
import type { documentCreate, documentUpdate } from "@/lib/validation/schemas";

export async function listDocuments(
  accountId: string,
  filters: { projectId?: string; category?: string; stageId?: string; taskId?: string; contactId?: string; search?: string } = {},
) {
  const db = await getDb();
  const conditions = [eq(documents.accountId, accountId), isNull(documents.deletedAt)];
  if (filters.projectId) conditions.push(eq(documents.projectId, filters.projectId));
  if (filters.category) conditions.push(eq(documents.category, filters.category as never));
  if (filters.stageId) conditions.push(eq(documents.stageId, filters.stageId));
  if (filters.taskId) conditions.push(eq(documents.taskId, filters.taskId));
  if (filters.contactId) conditions.push(eq(documents.contactId, filters.contactId));
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(or(ilike(documents.title, q), ilike(documents.notes, q), ilike(documents.fileName, q))!);
  }
  return db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(accountId: string, documentId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.accountId, accountId), isNull(documents.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Document not found");
  return rows[0];
}

/** Create a document record and store its file (multipart upload). */
export async function createDocument(
  accountId: string,
  userId: string,
  meta: z.infer<typeof documentCreate>,
  file: { name: string; type: string; data: Buffer } | null,
) {
  const db = await getDb();
  const id = newId();
  let storagePath: string | null = null;
  if (file) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    storagePath = `${accountId}/documents/${id}/${safeName}`;
    await putFile(storagePath, file.data, file.type || "application/octet-stream");
  }
  await db.insert(documents).values({
    id,
    accountId,
    createdBy: userId,
    ...meta,
    storagePath,
    fileName: file?.name ?? null,
    mimeType: file?.type ?? null,
    fileSize: file?.data.length ?? null,
  });
  const row = await getDocument(accountId, id);
  await writeAudit({ accountId, actorUserId: userId, tableName: "documents", recordId: id, action: "insert", newValues: row });
  await emitWebhookEvent(accountId, "document.added", {
    documentId: id,
    projectId: meta.projectId ?? null,
    title: meta.title,
    category: meta.category,
  });
  return row;
}

export async function updateDocument(accountId: string, userId: string, documentId: string, input: z.infer<typeof documentUpdate>) {
  const db = await getDb();
  const existing = await getDocument(accountId, documentId);
  await db
    .update(documents)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.accountId, accountId)));
  const updated = await getDocument(accountId, documentId);
  await writeAudit({
    accountId, actorUserId: userId, tableName: "documents", recordId: documentId,
    action: "update", oldValues: existing, newValues: updated,
  });
  return updated;
}

export async function softDeleteDocument(accountId: string, userId: string, documentId: string) {
  const db = await getDb();
  const existing = await getDocument(accountId, documentId);
  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.accountId, accountId)));
  await writeAudit({
    accountId, actorUserId: userId, tableName: "documents", recordId: documentId,
    action: "soft_delete", oldValues: existing,
  });
}

export async function getDocumentDownloadUrl(accountId: string, documentId: string) {
  const doc = await getDocument(accountId, documentId);
  if (!doc.storagePath) throw new NotFoundError("Document has no file attached");
  return getSignedUrl(doc.storagePath);
}
