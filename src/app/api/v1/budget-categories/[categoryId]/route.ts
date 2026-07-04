import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { budgetCategoryUpdate } from "@/lib/validation/schemas";
import { updateCategory } from "@/lib/services/budget";

export const PATCH = apiHandler<{ categoryId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, budgetCategoryUpdate);
  return json(await updateCategory(auth.accountId, params.categoryId, input));
});
