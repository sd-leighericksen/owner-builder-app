import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { variationCreate } from "@/lib/validation/schemas";
import { listVariations, createVariation } from "@/lib/services/budget";
import { moneyView } from "@/lib/services/util";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  const items = await listVariations(auth.accountId, params.projectId);
  return json({ items: items.map((v) => ({ ...v, money: moneyView(v) })) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, variationCreate.omit({ projectId: true }));
  const variation = await createVariation(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json({ ...variation, money: moneyView(variation) }, { status: 201 });
});
