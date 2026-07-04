import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { quoteCreate } from "@/lib/validation/schemas";
import { listQuotes, createQuote, compareQuotes } from "@/lib/services/quotes";
import { moneyView } from "@/lib/services/util";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ request, auth, params }) => {
  const url = new URL(request.url);
  const budgetCategoryId = url.searchParams.get("budgetCategoryId") ?? undefined;
  const compare = url.searchParams.get("compare") === "true";
  if (compare && budgetCategoryId) {
    const items = await compareQuotes(auth.accountId, params.projectId, budgetCategoryId);
    return json({ items: items.map((q) => ({ ...q, money: moneyView(q) })) });
  }
  const items = await listQuotes(auth.accountId, params.projectId, budgetCategoryId);
  return json({ items: items.map((q) => ({ ...q, money: moneyView(q) })) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, quoteCreate.omit({ projectId: true }));
  const quote = await createQuote(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json({ ...quote, money: moneyView(quote) }, { status: 201 });
});
