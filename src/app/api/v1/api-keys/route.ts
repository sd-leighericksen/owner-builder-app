import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { apiKeyCreate } from "@/lib/validation/schemas";
import { createApiKey, listApiKeys } from "@/lib/services/api-keys";

export const GET = apiHandler(async ({ auth }) => {
  return json({ items: await listApiKeys(auth.accountId) });
});

export const POST = apiHandler(async ({ request, auth }) => {
  const input = await parseBody(request, apiKeyCreate);
  const key = await createApiKey(auth.accountId, auth.userId, input.name, input.scopes);
  return json(key, { status: 201 }); // plaintext key returned once, never again
});
