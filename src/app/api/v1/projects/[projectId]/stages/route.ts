import { apiHandler, json } from "@/lib/api/handler";
import { listStages } from "@/lib/services/projects";

export const GET = apiHandler<{ projectId: string }>(async ({ auth, params }) => {
  return json({ items: await listStages(auth.accountId, params.projectId) });
});
