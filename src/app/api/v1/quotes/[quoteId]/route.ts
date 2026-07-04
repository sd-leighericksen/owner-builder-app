import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { quoteUpdate } from "@/lib/validation/schemas";
import { getQuote, updateQuote, softDeleteQuote } from "@/lib/services/quotes";
import { moneyView } from "@/lib/services/util";

type P = { quoteId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  const quote = await getQuote(auth.accountId, params.quoteId);
  return json({ ...quote, money: moneyView(quote) });
});

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, quoteUpdate);
  const quote = await updateQuote(auth.accountId, params.quoteId, input);
  return json({ ...quote, money: moneyView(quote) });
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteQuote(auth.accountId, params.quoteId);
  return json({ ok: true });
});
