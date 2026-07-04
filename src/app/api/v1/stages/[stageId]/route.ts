import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { stageUpdate } from "@/lib/validation/schemas";
import { updateStage } from "@/lib/services/projects";

export const PATCH = apiHandler<{ stageId: string }>(async ({ request, auth, params }) => {
  const input = await parseBody(request, stageUpdate);
  return json(await updateStage(auth.accountId, params.stageId, input));
});
