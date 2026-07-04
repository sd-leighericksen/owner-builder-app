import { apiHandler, json } from "@/lib/api/handler";
import { getDashboard } from "@/lib/services/dashboard";

export const GET = apiHandler<{ projectId: string }>(async ({ auth, params }) => {
  return json(await getDashboard(auth.accountId, params.projectId));
});
