import { apiHandler, json } from "@/lib/api/handler";
import { getBudgetSummary } from "@/lib/services/budget";

/** Budget dashboard: budget vs committed vs actual, contingency, GST (§5 P1.3). */
export const GET = apiHandler<{ projectId: string }>(async ({ auth, params }) => {
  return json(await getBudgetSummary(auth.accountId, params.projectId));
});
