import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { transactionUpdate } from "@/lib/validation/schemas";
import { updateTransaction, softDeleteTransaction } from "@/lib/services/budget";
import { moneyView } from "@/lib/services/util";

type P = { transactionId: string };

export const PATCH = apiHandler<P>(async ({ request, auth, params }) => {
  const input = await parseBody(request, transactionUpdate);
  const txn = await updateTransaction(auth.accountId, auth.userId, params.transactionId, input);
  return json({ ...txn, money: moneyView(txn) });
});

export const DELETE = apiHandler<P>(async ({ auth, params }) => {
  await softDeleteTransaction(auth.accountId, auth.userId, params.transactionId);
  return json({ ok: true });
});
