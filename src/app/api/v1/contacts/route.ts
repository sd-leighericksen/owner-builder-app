import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { contactCreate } from "@/lib/validation/schemas";
import { listContacts, createContact } from "@/lib/services/contacts";

export const GET = apiHandler(async ({ auth }) => {
  return json({ items: await listContacts(auth.accountId) });
});

export const POST = apiHandler(async ({ request, auth }) => {
  const input = await parseBody(request, contactCreate);
  return json(await createContact(auth.accountId, auth.userId, input), { status: 201 });
});
