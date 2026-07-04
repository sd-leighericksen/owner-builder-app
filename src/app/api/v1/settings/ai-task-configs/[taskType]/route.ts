import { apiHandler, json, parseBody } from "@/lib/api/handler";
import { aiTaskConfigUpdate, aiTaskTypeEnum } from "@/lib/validation/schemas";
import { updateAiTaskConfig } from "@/lib/services/ai/config";

export const PATCH = apiHandler<{ taskType: string }>(async ({ request, auth, params }) => {
  const taskType = aiTaskTypeEnum.parse(params.taskType);
  const input = await parseBody(request, aiTaskConfigUpdate);
  return json(await updateAiTaskConfig(auth.accountId, taskType, input));
});
