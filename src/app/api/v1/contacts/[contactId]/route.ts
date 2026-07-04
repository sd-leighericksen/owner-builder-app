import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { contactUpdate } from "@/lib/validation/schemas";
import { getContact, updateContact, softDeleteContact } from "@/lib/services/contacts";

type P = { contactId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json(await getContact(auth.accountId, params.contactId));
});

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, contactUpdate);
  return json(await updateContact(auth.accountId, params.contactId, input));
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteContact(auth.accountId, params.contactId);
  return json({ ok: true });
});
