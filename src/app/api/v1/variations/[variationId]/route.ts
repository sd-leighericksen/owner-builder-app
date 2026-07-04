import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { variationUpdate } from "@/lib/validation/schemas";
import { updateVariation } from "@/lib/services/budget";
import { moneyView } from "@/lib/services/util";

export const PATCH = apiHandler<{ variationId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, variationUpdate);
  const variation = await updateVariation(auth.accountId, auth.userId, params.variationId, input);
  return json({ ...variation, money: moneyView(variation) });
});
