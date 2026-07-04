import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { diaryEntries, photos } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import { putFile, getSignedUrl } from "./storage";
import type { diaryEntryCreate, diaryEntryRevise } from "@/lib/validation/schemas";

/**
 * Site diary. Entries are IMMUTABLE once created (brief §7.2) — editing
 * creates a revision row linked via revision_of_id; the original is marked
 * superseded but never mutated or deleted.
 */

export async function listDiaryEntries(accountId: string, projectId: string, includeSuperseded = false) {
  const db = await getDb();
  const conditions = [
    eq(diaryEntries.projectId, projectId),
    eq(diaryEntries.accountId, accountId),
    isNull(diaryEntries.deletedAt),
  ];
  if (!includeSuperseded) conditions.push(isNull(diaryEntries.supersededAt));
  const entries = await db
    .select()
    .from(diaryEntries)
    .where(and(...conditions))
    .orderBy(desc(diaryEntries.entryDate), desc(diaryEntries.id));

  if (entries.length === 0) return [];
  const entryPhotos = await db
    .select()
    .from(photos)
    .where(and(inArray(photos.diaryEntryId, entries.map((e) => e.id)), isNull(photos.deletedAt)));
  return Promise.all(
    entries.map(async (e) => ({
      ...e,
      photos: await withUrls(entryPhotos.filter((p) => p.diaryEntryId === e.id)),
    })),
  );
}

export async function createDiaryEntry(accountId: string, userId: string, input: z.infer<typeof diaryEntryCreate>) {
  const db = await getDb();
  const { photoIds, ...fields } = input;
  const id = newId();
  await db.insert(diaryEntries).values({ id, accountId, createdBy: userId, ...fields });
  if (photoIds.length > 0) {
    await db
      .update(photos)
      .set({ diaryEntryId: id })
      .where(and(inArray(photos.id, photoIds), eq(photos.accountId, accountId)));
  }
  return (await db.select().from(diaryEntries).where(eq(diaryEntries.id, id)))[0];
}

/** Create a revision superseding an existing entry. The original is untouched. */
export async function reviseDiaryEntry(
  accountId: string,
  userId: string,
  entryId: string,
  input: z.infer<typeof diaryEntryRevise>,
) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.id, entryId), eq(diaryEntries.accountId, accountId), isNull(diaryEntries.deletedAt)));
  const original = rows[0];
  if (!original) throw new NotFoundError("Diary entry not found");
  if (original.supersededAt) throw new NotFoundError("Entry already superseded — revise the latest revision");

  const { photoIds, ...fields } = input;
  const newEntryId = newId();
  await db.insert(diaryEntries).values({
    id: newEntryId,
    accountId,
    createdBy: userId,
    projectId: original.projectId,
    entryDate: fields.entryDate ?? original.entryDate,
    weather: fields.weather ?? original.weather,
    notes: fields.notes ?? original.notes,
    peopleOnSite: fields.peopleOnSite ?? original.peopleOnSite,
    entryType: fields.entryType ?? original.entryType,
    revisionOfId: original.id,
  });
  await db.update(diaryEntries).set({ supersededAt: new Date() }).where(eq(diaryEntries.id, original.id));

  // Carry photos over to the revision (photos are immutable evidence).
  await db.update(photos).set({ diaryEntryId: newEntryId }).where(eq(photos.diaryEntryId, original.id));
  if (photoIds && photoIds.length > 0) {
    await db
      .update(photos)
      .set({ diaryEntryId: newEntryId })
      .where(and(inArray(photos.id, photoIds), eq(photos.accountId, accountId)));
  }
  return (await db.select().from(diaryEntries).where(eq(diaryEntries.id, newEntryId)))[0];
}

// --- Photos --------------------------------------------------------------------

export async function listPhotos(accountId: string, projectId: string, stageId?: string) {
  const db = await getDb();
  const conditions = [
    eq(photos.projectId, projectId),
    eq(photos.accountId, accountId),
    isNull(photos.deletedAt),
  ];
  if (stageId) conditions.push(eq(photos.stageId, stageId));
  const rows = await db
    .select()
    .from(photos)
    .where(and(...conditions))
    .orderBy(desc(photos.takenAt), desc(photos.id));
  return withUrls(rows);
}

export async function createPhoto(
  accountId: string,
  userId: string,
  meta: { projectId: string; stageId?: string | null; caption?: string | null; takenAt?: string | null; diaryEntryId?: string | null },
  file: { name: string; type: string; data: Buffer },
  thumbnail: { type: string; data: Buffer } | null,
) {
  const db = await getDb();
  const id = newId();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const storagePath = `${accountId}/photos/${id}/original.${ext}`;
  await putFile(storagePath, file.data, file.type || "image/jpeg");
  let thumbnailPath: string | null = null;
  if (thumbnail) {
    thumbnailPath = `${accountId}/photos/${id}/thumb.${ext}`;
    await putFile(thumbnailPath, thumbnail.data, thumbnail.type);
  }
  await db.insert(photos).values({
    id,
    accountId,
    createdBy: userId,
    projectId: meta.projectId,
    stageId: meta.stageId ?? null,
    diaryEntryId: meta.diaryEntryId ?? null,
    caption: meta.caption ?? null,
    takenAt: meta.takenAt ? new Date(meta.takenAt) : new Date(),
    storagePath,
    thumbnailPath,
  });
  const row = (await db.select().from(photos).where(eq(photos.id, id)))[0];
  return (await withUrls([row]))[0];
}

async function withUrls<T extends { storagePath: string | null; thumbnailPath: string | null }>(rows: T[]) {
  return Promise.all(
    rows.map(async (p) => ({
      ...p,
      url: p.storagePath ? await getSignedUrl(p.storagePath) : null,
      thumbnailUrl: p.thumbnailPath
        ? await getSignedUrl(p.thumbnailPath)
        : p.storagePath
          ? await getSignedUrl(p.storagePath)
          : null,
    })),
  );
}
