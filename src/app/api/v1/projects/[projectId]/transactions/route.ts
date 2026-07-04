import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { transactionCreate } from "@/lib/validation/schemas";
import { listTransactions, createTransaction } from "@/lib/services/budget";
import { moneyView } from "@/lib/services/util";

type P = { projectId: string };

export const GET = apiHandler<P>(async ({ auth, params }) => {
  const items = await listTransactions(auth.accountId, params.projectId);
  return json({ items: items.map((t) => ({ ...t, money: moneyView(t) })) });
});

export const POST = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, transactionCreate.omit({ projectId: true }));
  const txn = await createTransaction(auth.accountId, auth.userId, { ...input, projectId: params.projectId });
  return json({ ...txn, money: moneyView(txn) }, { status: 201 });
});
