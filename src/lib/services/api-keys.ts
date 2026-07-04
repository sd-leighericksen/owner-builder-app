import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { newId } from "@/lib/ids";
import { hashApiKey } from "@/lib/auth";
import { NotFoundError } from "@/lib/api/handler";

/**
 * Scoped, revocable API keys for machine access — n8n automations etc.
 * (brief §3 Auth, §7.6). The plaintext key is shown exactly once at creation;
 * only its SHA-256 hash is stored.
 */
export async function createApiKey(accountId: string, userId: string, name: string, scopes: string[]) {
  const db = await getDb();
  const plaintext = `ob_${randomBytes(24).toString("base64url")}`;
  const id = newId();
  await db.insert(apiKeys).values({
    id,
    accountId,
    createdBy: userId,
    name,
    scopes,
    keyHash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 8),
  });
  return { id, name, scopes, prefix: plaintext.slice(0, 8), key: plaintext };
}

export async function listApiKeys(accountId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.deletedAt)))
    .orderBy(asc(apiKeys.createdAt));
  return rows.map(({ keyHash: _hash, ...rest }) => rest);
}

export async function revokeApiKey(accountId: string, keyId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.accountId, accountId), isNull(apiKeys.deletedAt)));
  if (!rows[0]) throw new NotFoundError("API key not found");
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
}
