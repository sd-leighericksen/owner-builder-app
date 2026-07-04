import { and, asc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { contacts, contactInsurances } from "@/db/schema";
import { newId } from "@/lib/ids";
import { NotFoundError } from "@/lib/api/handler";
import type { contactCreate, contactUpdate, insuranceCreate } from "@/lib/validation/schemas";

export async function listContacts(accountId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), isNull(contacts.deletedAt)))
    .orderBy(asc(contacts.businessName));
  const insurances = await db
    .select()
    .from(contactInsurances)
    .where(and(eq(contactInsurances.accountId, accountId), isNull(contactInsurances.deletedAt)));
  return rows.map((c) => ({
    ...c,
    insurances: insurances.filter((i) => i.contactId === c.id),
  }));
}

export async function getContact(accountId: string, contactId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId), isNull(contacts.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Contact not found");
  const insurances = await db
    .select()
    .from(contactInsurances)
    .where(and(eq(contactInsurances.contactId, contactId), isNull(contactInsurances.deletedAt)));
  return { ...rows[0], insurances };
}

export async function createContact(accountId: string, userId: string, input: z.infer<typeof contactCreate>) {
  const db = await getDb();
  const id = newId();
  await db.insert(contacts).values({ id, accountId, createdBy: userId, ...input, email: input.email || null });
  return getContact(accountId, id);
}

export async function updateContact(accountId: string, contactId: string, input: z.infer<typeof contactUpdate>) {
  const db = await getDb();
  await getContact(accountId, contactId);
  await db
    .update(contacts)
    .set({ ...input, email: input.email || null, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));
  return getContact(accountId, contactId);
}

export async function softDeleteContact(accountId: string, contactId: string) {
  const db = await getDb();
  await getContact(accountId, contactId);
  await db
    .update(contacts)
    .set({ deletedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));
}

export async function addInsurance(
  accountId: string,
  userId: string,
  contactId: string,
  input: z.infer<typeof insuranceCreate>,
) {
  const db = await getDb();
  await getContact(accountId, contactId);
  const id = newId();
  await db.insert(contactInsurances).values({ id, accountId, createdBy: userId, contactId, ...input });
  return (await db.select().from(contactInsurances).where(eq(contactInsurances.id, id)))[0];
}

export async function removeInsurance(accountId: string, insuranceId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(contactInsurances)
    .where(and(eq(contactInsurances.id, insuranceId), eq(contactInsurances.accountId, accountId), isNull(contactInsurances.deletedAt)));
  if (!rows[0]) throw new NotFoundError("Insurance not found");
  await db.update(contactInsurances).set({ deletedAt: new Date() }).where(eq(contactInsurances.id, insuranceId));
}
