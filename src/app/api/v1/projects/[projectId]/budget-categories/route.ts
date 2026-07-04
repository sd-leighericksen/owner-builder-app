import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { budgetCategoryCreate } from "@/lib/validation/schemas";
import { listCategories, createCategory } from "@/lib/services/budget";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  return json({ items: await listCategories(auth.accountId, params.projectId) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, budgetCategoryCreate.omit({ projectId: true }));
  const category = await createCategory(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json(category, { status: 201 });
});
