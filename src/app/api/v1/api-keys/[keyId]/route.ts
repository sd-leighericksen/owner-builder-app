import { apiHandler, json } from "@/lib/api/handler";
import { revokeApiKey } from "@/lib/services/api-keys";

export const DELETE = apiHandler<{ keyId: string }>(async ({ auth, params }) => {
  await revokeApiKey(auth.accountId, params.keyId);
  return json({ ok: true });
});
