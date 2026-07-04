import { apiHandler, json } from "@/lib/api/handler";
import { listAiTaskConfigs, getAiUsageSummary } from "@/lib/services/ai/config";

export const GET = apiHandler(async ({ auth }) => {
  const [items, usage] = await Promise.all([
    listAiTaskConfigs(auth.accountId),
    getAiUsageSummary(auth.accountId),
  ]);
  return json({ items, usage });
});
